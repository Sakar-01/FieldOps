import { randomBytes } from "node:crypto";
import { ObjectId, type ClientSession, type UpdateFilter } from "mongodb";
import type { AuthContext } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/client";
import { businessesRepo } from "@/lib/db/repositories/businesses";
import { customersRepo } from "@/lib/db/repositories/customers";
import { jobsRepo, type JobSearch } from "@/lib/db/repositories/jobs";
import { photosRepo } from "@/lib/db/repositories/photos";
import { usersRepo } from "@/lib/db/repositories/users";
import type { JobDoc, PhotoDoc, StatusChange } from "@/lib/db/types";
import {
  checkTransition,
  isFinal,
  isOverdue,
  statusForAssignment,
  type JobStatus,
  type TransitionResult,
} from "@/lib/domain/job-status";
import { validateWindow, type TimeWindow } from "@/lib/domain/overlap";
import { dayWindow, formatWindow, todayWindow } from "@/lib/domain/time";
import {
  AppError,
  forbidden,
  invalidInput,
  notFound,
  preconditionFailed,
  versionConflict,
} from "@/lib/http/errors";
import { getStorage, jobFolder, KEY_PATTERN } from "@/lib/storage";
import {
  MAX_PHOTOS_PER_JOB,
  MAX_UPLOAD_BYTES,
  type ChangeStatusInput,
  type CreateJobInput,
  type ListJobsQuery,
  type SavePhotoInput,
  type UpdateJobInput,
  type UploadKind,
} from "@/lib/validators/jobs";
import type { AddressDto } from "./customers";

// ---------------------------------------------------------------------------------------------
// DTOs

export interface PhotoDto {
  id: string;
  kind: PhotoDoc["kind"];
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface StatusChangeDto {
  from: JobStatus | null;
  to: JobStatus;
  by: string;
  at: string;
  reason?: string;
}

export interface JobDto {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: AddressDto;
  technicianId: string | null;
  technicianName: string | null;
  title: string;
  description: string;
  priority: JobDoc["priority"];
  status: JobStatus;
  overdue: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  signature: { url: string; signedAt: string } | null;
  cancelReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetailDto extends JobDto {
  photos: PhotoDto[];
  statusHistory: StatusChangeDto[];
  timezone: string;
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

function toJobDto(job: JobDoc, names: Map<string, string>): JobDto {
  const technicianId = job.technicianId?.toHexString() ?? null;
  const { _id: addressId, ...address } = job.address;
  return {
    id: job._id.toHexString(),
    number: job.number,
    customerId: job.customerId.toHexString(),
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    address: { id: addressId.toHexString(), ...address },
    technicianId,
    technicianName: technicianId ? (names.get(technicianId) ?? "Former team member") : null,
    title: job.title,
    description: job.description,
    priority: job.priority,
    status: job.status,
    overdue: isOverdue(job),
    scheduledStart: job.scheduledStart.toISOString(),
    scheduledEnd: job.scheduledEnd.toISOString(),
    startedAt: iso(job.startedAt),
    completedAt: iso(job.completedAt),
    notes: job.notes,
    signature: job.signature
      ? { url: job.signature.url, signedAt: job.signature.signedAt.toISOString() }
      : null,
    cancelReason: job.cancelReason,
    version: job.version,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function toPhotoDto(photo: PhotoDoc): PhotoDto {
  const storage = getStorage();
  return {
    id: photo._id.toHexString(),
    kind: photo.kind,
    url: photo.url,
    thumbUrl: storage.getUrl(photo.key, { width: 400 }),
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt.toISOString(),
  };
}

/** Names for every technician and history author on these jobs, in one query. */
async function namesFor(ctx: AuthContext, jobs: JobDoc[]) {
  const ids = new Map<string, ObjectId>();
  for (const job of jobs) {
    if (job.technicianId) ids.set(job.technicianId.toHexString(), job.technicianId);
    for (const change of job.statusHistory) ids.set(change.byUserId.toHexString(), change.byUserId);
  }
  return usersRepo.namesByIds(ctx.businessId, [...ids.values()]);
}

async function timezoneOf(ctx: AuthContext): Promise<string> {
  return (await businessesRepo.findById(ctx.businessId))?.timezone ?? "Asia/Kolkata";
}

// ---------------------------------------------------------------------------------------------
// Access

const isOffice = (ctx: AuthContext) => ctx.role === "owner" || ctx.role === "dispatcher";

/**
 * Every job read and write starts here. NFR-SEC-02: scoped to the caller's business.
 * NFR-SEC-03: a technician only reaches jobs assigned to them, and gets 403 otherwise.
 */
async function loadJob(ctx: AuthContext, id: ObjectId): Promise<JobDoc> {
  const job = await jobsRepo.findById(ctx.businessId, id);
  if (!job) throw notFound("Job");
  if (ctx.role === "technician" && !job.technicianId?.equals(ctx.userId)) {
    throw forbidden("This job isn't assigned to you");
  }
  return job;
}

function throwIfRejected(result: TransitionResult): void {
  if (result.ok) return;
  if (result.code === "FORBIDDEN") throw forbidden(result.message);
  if (result.code === "PRECONDITION") throw preconditionFailed(result.message);
  throw new AppError(409, "INVALID_TRANSITION", result.message);
}

// ---------------------------------------------------------------------------------------------
// Booking: overlap check and write in one transaction

/**
 * FR-JOB-05. Claiming the technician's schedule (a write to their user document) makes two
 * concurrent bookings for the same technician conflict, so one of them is retried by the driver
 * and then sees the other's job. Without it both could pass the check before either writes.
 */
async function assertBookable(
  ctx: AuthContext,
  technicianId: ObjectId,
  window: TimeWindow,
  excludeJobId: ObjectId | null,
  session: ClientSession,
  timezone: string,
): Promise<void> {
  const technician = await usersRepo.claimSchedule(ctx.businessId, technicianId, session);
  if (!technician) {
    throw invalidInput("technicianId", "Pick an active technician from your team");
  }
  const clash = await jobsRepo.findOverlap(
    ctx.businessId,
    technicianId,
    window,
    excludeJobId,
    session,
  );
  if (clash) {
    throw new AppError(
      409,
      "JOB_OVERLAP",
      `${technician.name} already has ${clash.number} at ${formatWindow(clash.scheduledStart, clash.scheduledEnd, timezone)}`,
      {
        conflictingJobId: clash._id.toHexString(),
        conflictingJobNumber: clash.number,
        scheduledStart: clash.scheduledStart.toISOString(),
        scheduledEnd: clash.scheduledEnd.toISOString(),
      },
    );
  }
}

const historyEntry = (
  ctx: AuthContext,
  from: JobStatus | null,
  to: JobStatus,
  reason?: string,
): StatusChange => ({
  from,
  to,
  byUserId: ctx.userId,
  at: new Date(),
  ...(reason && { reason }),
});

// ---------------------------------------------------------------------------------------------
// Commands

/** FR-JOB-01, FR-JOB-02 */
export async function createJob(ctx: AuthContext, input: CreateJobInput): Promise<JobDto> {
  const customer = await customersRepo.findById(ctx.businessId, new ObjectId(input.customerId));
  if (!customer) throw invalidInput("customerId", "Pick a customer");
  const address = customer.addresses.find((a) => a._id.equals(new ObjectId(input.addressId)));
  if (!address) throw invalidInput("addressId", "Pick one of the customer's addresses");

  const technicianId = input.technicianId ? new ObjectId(input.technicianId) : null;
  const status: JobStatus = technicianId ? "scheduled" : "unassigned";
  const window = { start: input.scheduledStart, end: input.scheduledEnd };
  const timezone = await timezoneOf(ctx);

  const job = await withTransaction(async (session) => {
    if (technicianId) await assertBookable(ctx, technicianId, window, null, session, timezone);
    const counter = await businessesRepo.nextJobNumber(ctx.businessId, session);
    const now = new Date();
    const doc: JobDoc = {
      _id: new ObjectId(),
      businessId: ctx.businessId,
      number: `FO-${String(counter).padStart(4, "0")}`,
      customerId: customer._id,
      address,
      customerName: customer.name,
      customerPhone: customer.phone,
      technicianId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      startedAt: null,
      completedAt: null,
      notes: "",
      signature: null,
      cancelReason: null,
      statusHistory: [historyEntry(ctx, null, status)],
      version: 0,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };
    await jobsRepo.insert(doc, session);
    return doc;
  });

  return toJobDto(job, await namesFor(ctx, [job]));
}

/** FR-JOB-03, FR-JOB-05, FR-JOB-06: edit, assign, reassign and reschedule. */
export async function updateJob(
  ctx: AuthContext,
  id: ObjectId,
  input: UpdateJobInput,
): Promise<JobDto> {
  const job = await loadJob(ctx, id);
  if (job.version !== input.version) throw versionConflict();
  if (isFinal(job.status)) {
    throw new AppError(409, "INVALID_TRANSITION", `A ${job.status} job can't be edited`);
  }

  const window = {
    start: input.scheduledStart ?? job.scheduledStart,
    end: input.scheduledEnd ?? job.scheduledEnd,
  };
  const windowError = validateWindow(window);
  if (windowError) throw invalidInput("scheduledEnd", windowError);

  const technicianId =
    input.technicianId === undefined
      ? job.technicianId
      : input.technicianId
        ? new ObjectId(input.technicianId)
        : null;
  const technicianChanged =
    technicianId && job.technicianId
      ? !technicianId.equals(job.technicianId)
      : technicianId !== job.technicianId;
  const windowChanged =
    window.start.getTime() !== job.scheduledStart.getTime() ||
    window.end.getTime() !== job.scheduledEnd.getTime();

  if (job.status === "in_progress" && technicianChanged) {
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      "A job in progress can't be reassigned. Cancel it and create a new one instead.",
    );
  }

  const status = statusForAssignment(job.status, technicianId !== null);
  if (status !== job.status) {
    throwIfRejected(
      checkTransition({
        from: job.status,
        to: status,
        role: ctx.role,
        isAssignedTechnician: false,
        hasTechnician: technicianId !== null,
        afterPhotoCount: 0,
        hasSignature: false,
      }),
    );
  }

  const set: Partial<JobDoc> = {
    technicianId,
    status,
    scheduledStart: window.start,
    scheduledEnd: window.end,
    updatedAt: new Date(),
  };
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description;
  if (input.priority !== undefined) set.priority = input.priority;
  if (input.addressId && !job.address._id.equals(new ObjectId(input.addressId))) {
    const customer = await customersRepo.findById(ctx.businessId, job.customerId);
    const address = customer?.addresses.find((a) => a._id.equals(new ObjectId(input.addressId)));
    if (!address) throw invalidInput("addressId", "Pick one of the customer's addresses");
    set.address = address;
  }

  const update: UpdateFilter<JobDoc> = { $set: set };
  if (status !== job.status)
    update.$push = { statusHistory: historyEntry(ctx, job.status, status) };

  // Rescheduling or reassigning re-runs the overlap check (section 6).
  const needsCheck = technicianId !== null && (technicianChanged || windowChanged);
  const timezone = needsCheck ? await timezoneOf(ctx) : "";

  const updated = await withTransaction(async (session) => {
    if (needsCheck) await assertBookable(ctx, technicianId, window, job._id, session, timezone);
    return jobsRepo.updateIfVersion(ctx.businessId, id, input.version, update, session);
  });
  if (!updated) throw versionConflict();
  return toJobDto(updated, await namesFor(ctx, [updated]));
}

/** FR-JOB-04, FR-JOB-08, FR-TECH-02 */
export async function changeStatus(
  ctx: AuthContext,
  id: ObjectId,
  input: ChangeStatusInput,
): Promise<JobDto> {
  const job = await loadJob(ctx, id);
  const afterPhotoCount =
    input.to === "completed" ? await photosRepo.countForJob(ctx.businessId, id, "after") : 0;

  throwIfRejected(
    checkTransition({
      from: job.status,
      to: input.to,
      role: ctx.role,
      isAssignedTechnician: job.technicianId?.equals(ctx.userId) ?? false,
      hasTechnician: job.technicianId !== null,
      afterPhotoCount,
      hasSignature: job.signature !== null,
      reason: input.reason,
    }),
  );

  const now = new Date();
  const set: Partial<JobDoc> = { status: input.to, updatedAt: now };
  if (input.to === "in_progress") set.startedAt = now;
  if (input.to === "completed") set.completedAt = now;
  if (input.to === "cancelled") set.cancelReason = input.reason!.trim();

  const updated = await jobsRepo.updateIfStatus(ctx.businessId, id, job.status, {
    $set: set,
    $push: {
      statusHistory: historyEntry(ctx, job.status, input.to, set.cancelReason ?? undefined),
    },
  });
  if (!updated) throw versionConflict();
  return toJobDto(updated, await namesFor(ctx, [updated]));
}

/** FR-TECH-03 */
export async function updateNotes(ctx: AuthContext, id: ObjectId, notes: string): Promise<JobDto> {
  const job = await loadJob(ctx, id);
  if (!job.technicianId?.equals(ctx.userId))
    throw forbidden("Only the assigned technician can do this");
  if (isFinal(job.status)) throw preconditionFailed(`Notes on a ${job.status} job can't change`);

  const updated = await jobsRepo.updateIfStatus(ctx.businessId, id, job.status, {
    $set: { notes, updatedAt: new Date() },
  });
  if (!updated) throw versionConflict();
  return toJobDto(updated, await namesFor(ctx, [updated]));
}

// ---------------------------------------------------------------------------------------------
// Queries

/** FR-JOB-07 */
export async function listJobs(ctx: AuthContext, query: ListJobsQuery) {
  const search: JobSearch = {
    status: query.status,
    priority: query.priority,
    cursor: query.cursor ? new ObjectId(query.cursor) : undefined,
    limit: query.limit,
  };
  if (query.customerId) search.customerId = new ObjectId(query.customerId);
  if (query.technicianId) {
    search.technicianId = query.technicianId === "none" ? null : new ObjectId(query.technicianId);
  }
  // Technicians only ever see their own jobs, whatever filter they send (NFR-SEC-03).
  if (ctx.role === "technician") search.technicianId = ctx.userId;

  if (query.from || query.to) {
    const timezone = await timezoneOf(ctx);
    if (query.from) search.from = dayWindow(query.from, timezone).start;
    if (query.to) search.to = dayWindow(query.to, timezone).end; // "to" is inclusive
  }
  if (query.q) {
    const number = query.q.match(/^(?:FO-?)?(\d{1,6})$/i);
    if (number) search.number = `FO-${number[1].padStart(4, "0")}`;
    else search.customerName = query.q;
  }

  const rows = await jobsRepo.search(ctx.businessId, search);
  const items = rows.slice(0, query.limit);
  const names = await namesFor(ctx, items);
  return {
    items: items.map((job) => toJobDto(job, names)),
    nextCursor: rows.length > query.limit ? items[items.length - 1]._id.toHexString() : null,
  };
}

export async function getJob(ctx: AuthContext, id: ObjectId): Promise<JobDetailDto> {
  const job = await loadJob(ctx, id);
  const [photos, names, timezone] = await Promise.all([
    photosRepo.listForJob(ctx.businessId, id),
    namesFor(ctx, [job]),
    timezoneOf(ctx),
  ]);
  return {
    ...toJobDto(job, names),
    photos: photos.map(toPhotoDto),
    statusHistory: job.statusHistory.map((change) => ({
      from: change.from,
      to: change.to,
      by: names.get(change.byUserId.toHexString()) ?? "Former team member",
      at: change.at.toISOString(),
      ...(change.reason && { reason: change.reason }),
    })),
    timezone,
  };
}

/** FR-TECH-01 */
export async function techToday(ctx: AuthContext) {
  const timezone = await timezoneOf(ctx);
  const jobs = await jobsRepo.forTechnicianDay(ctx.businessId, ctx.userId, todayWindow(timezone));
  const names = await namesFor(ctx, jobs);
  return { timezone, items: jobs.map((job) => toJobDto(job, names)) };
}

// ---------------------------------------------------------------------------------------------
// Photos and signature (FR-FILE-01..03)

/** Office staff and the assigned technician; never on a finished job. */
async function loadJobForUpload(ctx: AuthContext, id: ObjectId): Promise<JobDoc> {
  const job = await loadJob(ctx, id);
  if (isFinal(job.status)) throw preconditionFailed(`Files on a ${job.status} job can't change`);
  return job;
}

export async function signUpload(ctx: AuthContext, jobId: ObjectId, kind: UploadKind) {
  const job = await loadJobForUpload(ctx, jobId);
  if (kind === "signature") {
    if (!job.technicianId?.equals(ctx.userId)) {
      throw forbidden("Only the assigned technician captures the signature");
    }
  } else if ((await photosRepo.countForJob(ctx.businessId, jobId)) >= MAX_PHOTOS_PER_JOB) {
    throw preconditionFailed(`A job can have at most ${MAX_PHOTOS_PER_JOB} photos`);
  }
  // The server picks the key, and the signature pins it, so uploads stay in the job's folder.
  const key = `${jobFolder(ctx.businessId.toHexString(), jobId.toHexString())}/${kind}-${randomBytes(8).toString("hex")}`;
  return getStorage().createUploadParams({ key, maxBytes: MAX_UPLOAD_BYTES });
}

/** Confirms the file exists, belongs to this job, and is within limits. Removes it if not. */
async function verifyUploadedFile(
  ctx: AuthContext,
  jobId: ObjectId,
  key: string,
  kind: UploadKind,
) {
  const folder = jobFolder(ctx.businessId.toHexString(), jobId.toHexString());
  if (!KEY_PATTERN.test(key) || !key.startsWith(`${folder}/${kind}-`)) {
    throw invalidInput("key", "This upload doesn't belong to this job");
  }
  const storage = getStorage();
  const stored = await storage.describe(key);
  if (!stored) throw invalidInput("key", "The upload didn't finish. Please try again.");
  if (stored.bytes > MAX_UPLOAD_BYTES) {
    await storage.delete(key);
    throw invalidInput("key", "Images can be at most 5 MB");
  }
  return stored;
}

export async function addPhoto(ctx: AuthContext, jobId: ObjectId, input: SavePhotoInput) {
  await loadJobForUpload(ctx, jobId);
  if ((await photosRepo.countForJob(ctx.businessId, jobId)) >= MAX_PHOTOS_PER_JOB) {
    throw preconditionFailed(`A job can have at most ${MAX_PHOTOS_PER_JOB} photos`);
  }
  const stored = await verifyUploadedFile(ctx, jobId, input.key, input.kind);
  const photo = await photosRepo.insert({
    businessId: ctx.businessId,
    jobId,
    kind: input.kind,
    key: input.key,
    url: getStorage().getUrl(input.key),
    width: stored.width ?? input.width,
    height: stored.height ?? input.height,
    bytes: stored.bytes,
    uploadedBy: ctx.userId,
  });
  return toPhotoDto(photo);
}

export async function deletePhoto(ctx: AuthContext, jobId: ObjectId, photoId: ObjectId) {
  await loadJobForUpload(ctx, jobId);
  const photo = await photosRepo.remove(ctx.businessId, jobId, photoId);
  if (!photo) throw notFound("Photo");
  await getStorage().delete(photo.key);
}

export async function saveSignature(ctx: AuthContext, jobId: ObjectId, key: string) {
  const job = await loadJobForUpload(ctx, jobId);
  if (!job.technicianId?.equals(ctx.userId)) {
    throw forbidden("Only the assigned technician captures the signature");
  }
  if (job.status !== "in_progress") throw preconditionFailed("Start the job before signing");
  await verifyUploadedFile(ctx, jobId, key, "signature");

  const storage = getStorage();
  const updated = await jobsRepo.updateIfStatus(ctx.businessId, jobId, job.status, {
    $set: {
      signature: { key, url: storage.getUrl(key), signedAt: new Date() },
      updatedAt: new Date(),
    },
  });
  if (!updated) throw versionConflict();
  // A replaced signature leaves its old file behind otherwise.
  if (job.signature && job.signature.key !== key) await storage.delete(job.signature.key);
  return toJobDto(updated, await namesFor(ctx, [updated]));
}

/** Office pages offer only technicians who can take work (FR-JOB-03). */
export async function assignableTechnicians(ctx: AuthContext) {
  if (!isOffice(ctx)) throw forbidden();
  const users = await usersRepo.list(ctx.businessId, { role: "technician", active: true });
  return users.map((u) => ({ id: u._id.toHexString(), name: u.name }));
}

/** For pages that show times: everything is displayed in the business timezone. */
export const businessTimezone = timezoneOf;
