import { z } from "zod";
import { JOB_STATUSES } from "@/lib/domain/job-status";
import { validateWindow } from "@/lib/domain/overlap";
import { PHOTO_KINDS, PRIORITIES } from "@/lib/db/types";
import { objectIdSchema, paginationSchema } from "./common";

/** ISO 8601 with an offset or Z; the browser converts from the business timezone. */
const instantSchema = z.iso
  .datetime({ offset: true, message: "Enter a valid date and time" })
  .transform((value) => new Date(value));

const titleSchema = z.string().trim().min(3, "Title is too short").max(120);
const descriptionSchema = z.string().trim().max(2000);

function refineWindow(value: { scheduledStart?: Date; scheduledEnd?: Date }, ctx: z.RefinementCtx) {
  if (!value.scheduledStart || !value.scheduledEnd) return;
  const message = validateWindow({ start: value.scheduledStart, end: value.scheduledEnd });
  if (message) ctx.addIssue({ code: "custom", path: ["scheduledEnd"], message });
}

/** FR-JOB-01 */
export const createJobSchema = z
  .object({
    customerId: objectIdSchema,
    addressId: objectIdSchema,
    title: titleSchema,
    description: descriptionSchema.default(""),
    priority: z.enum(PRIORITIES).default("normal"),
    scheduledStart: instantSchema,
    scheduledEnd: instantSchema,
    technicianId: objectIdSchema.nullable().default(null),
  })
  .superRefine(refineWindow);
export type CreateJobInput = z.output<typeof createJobSchema>;

/** FR-JOB-03, FR-JOB-06: edit, assign and reschedule all go through here with the version. */
export const updateJobSchema = z
  .object({
    version: z.number().int().min(0),
    addressId: objectIdSchema.optional(),
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    priority: z.enum(PRIORITIES).optional(),
    scheduledStart: instantSchema.optional(),
    scheduledEnd: instantSchema.optional(),
    technicianId: objectIdSchema.nullable().optional(),
  })
  .superRefine(refineWindow)
  .refine((value) => Object.keys(value).length > 1, "Nothing to update");
export type UpdateJobInput = z.output<typeof updateJobSchema>;

/** Assignment moves between unassigned and scheduled through PATCH technicianId instead. */
export const STATUS_ENDPOINT_TARGETS = ["in_progress", "completed", "cancelled"] as const;

export const changeStatusSchema = z.object({
  to: z.enum(STATUS_ENDPOINT_TARGETS),
  reason: z.string().trim().max(500).optional(),
});
export type ChangeStatusInput = z.output<typeof changeStatusSchema>;

/** FR-TECH-03 */
export const MAX_NOTES = 2000;
export const updateNotesSchema = z.object({
  notes: z.string().trim().max(MAX_NOTES, `Notes can be at most ${MAX_NOTES} characters`),
});

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** FR-JOB-07. Cleared fields ("") and the filter form's "any" both mean "no filter". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" || value === "any" ? undefined : value), schema.optional());

export const listJobsQuerySchema = paginationSchema.extend({
  status: optional(z.enum(JOB_STATUSES)),
  priority: optional(z.enum(PRIORITIES)),
  technicianId: optional(z.union([objectIdSchema, z.literal("none")])),
  customerId: optional(objectIdSchema),
  from: optional(dayString),
  to: optional(dayString),
  q: optional(z.string().trim().max(100)),
});
export type ListJobsQuery = z.output<typeof listJobsQuerySchema>;

/** FR-FILE-01 */
export const UPLOAD_KINDS = [...PHOTO_KINDS, "signature"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_JOB = 10;
export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

export const signUploadSchema = z.object({
  jobId: objectIdSchema,
  kind: z.enum(UPLOAD_KINDS),
});

export const savePhotoSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  key: z.string().min(1).max(300),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
export type SavePhotoInput = z.output<typeof savePhotoSchema>;

export const saveSignatureSchema = z.object({ key: z.string().min(1).max(300) });
