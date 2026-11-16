import { rm } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as postCustomer } from "@/app/api/customers/route";
import { PATCH as patchNotes } from "@/app/api/jobs/[id]/notes/route";
import { POST as postPhoto } from "@/app/api/jobs/[id]/photos/route";
import { GET as getJobRoute, PATCH as patchJob } from "@/app/api/jobs/[id]/route";
import { PUT as putSignature } from "@/app/api/jobs/[id]/signature/route";
import { POST as postStatus } from "@/app/api/jobs/[id]/status/route";
import { GET as listJobsRoute, POST as postJob } from "@/app/api/jobs/route";
import { GET as techTodayRoute } from "@/app/api/tech/today/route";
import { POST as localUpload } from "@/app/api/uploads/local/route";
import { POST as signRoute } from "@/app/api/uploads/sign/route";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";
import type { UploadParams } from "@/lib/storage";
import {
  addMember,
  createBusiness,
  idContext,
  PASSWORD,
  request,
  sampleCustomer,
  sessionCookieFrom,
} from "../helpers/api";

// A 1x1 PNG, so the local driver's magic-byte check sees a real image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function loginAs(email: string) {
  const response = await login(
    request("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } }),
    undefined,
  );
  expect(response.status).toBe(200);
  return sessionCookieFrom(response);
}

// Fixed times far from "now", in UTC.
const at = (time: string, day = "2030-03-04") => `${day}T${time}:00.000Z`;

describe("jobs (FR-JOB-01..08)", () => {
  let owner: string;
  let techA: { id: string; cookie: string };
  let techB: { id: string; cookie: string };
  let customer: { id: string; addresses: { id: string }[] };

  const create = async (body: Record<string, unknown>, cookie = owner) =>
    postJob(
      request("/api/jobs", {
        method: "POST",
        cookie,
        body: {
          customerId: customer.id,
          addressId: customer.addresses[0].id,
          title: "AC not cooling",
          scheduledStart: at("10:00"),
          scheduledEnd: at("12:00"),
          ...body,
        },
      }),
      undefined,
    );

  const createOk = async (body: Record<string, unknown> = {}) => {
    const response = await create(body);
    expect(response.status).toBe(201);
    return response.json();
  };

  const patch = (id: string, body: Record<string, unknown>, cookie = owner) =>
    patchJob(request(`/api/jobs/${id}`, { method: "PATCH", cookie, body }), idContext(id));

  const status = (id: string, body: Record<string, unknown>, cookie: string) =>
    postStatus(request(`/api/jobs/${id}/status`, { method: "POST", cookie, body }), idContext(id));

  beforeAll(async () => {
    await createIndexes(await getDb());
    const business = await createBusiness("Jobs Co");
    owner = business.cookie;
    const a = await addMember(owner, "technician");
    const b = await addMember(owner, "technician");
    techA = { id: a.id, cookie: await loginAs(a.email) };
    techB = { id: b.id, cookie: await loginAs(b.email) };
    const response = await postCustomer(
      request("/api/customers", { method: "POST", cookie: owner, body: sampleCustomer() }),
      undefined,
    );
    customer = await response.json();
  });

  afterAll(async () => {
    await rm(path.join(process.cwd(), "uploads", "fieldops"), { recursive: true, force: true });
  });

  it("creates unassigned and scheduled jobs with sequential numbers", async () => {
    const first = await createOk({ scheduledStart: at("06:00"), scheduledEnd: at("07:00") });
    const second = await createOk({
      technicianId: techA.id,
      scheduledStart: at("06:00"),
      scheduledEnd: at("07:00"),
    });
    expect(first.status).toBe("unassigned");
    expect(second.status).toBe("scheduled");
    expect(second.technicianName).toBe("Test technician");
    expect(Number(second.number.slice(3))).toBe(Number(first.number.slice(3)) + 1);
    expect(first.number).toMatch(/^FO-\d{4}$/);
    expect(first.address.line1).toBe("12 MG Road");
  });

  it("rejects an address that isn't the customer's and a too-short window", async () => {
    const wrongAddress = await create({ addressId: "0123456789abcdef01234567" });
    expect(wrongAddress.status).toBe(400);
    const short = await create({ scheduledEnd: at("10:10") });
    expect(short.status).toBe(400);
  });

  it("only lets office staff create jobs", async () => {
    expect((await create({}, techA.cookie)).status).toBe(403);
  });

  describe("overlap check (FR-JOB-05)", () => {
    const day = "2030-03-05";
    let booked: { id: string; number: string };

    beforeAll(async () => {
      booked = await createOk({
        technicianId: techA.id,
        scheduledStart: at("10:00", day),
        scheduledEnd: at("12:00", day),
      });
    });

    it("rejects an overlapping booking with 409 and names the conflicting job", async () => {
      const response = await create({
        technicianId: techA.id,
        scheduledStart: at("11:00", day),
        scheduledEnd: at("13:00", day),
      });
      expect(response.status).toBe(409);
      const { error } = await response.json();
      expect(error.code).toBe("JOB_OVERLAP");
      expect(error.details.conflictingJobId).toBe(booked.id);
      expect(error.message).toContain(booked.number);
    });

    it("allows touching windows and other technicians", async () => {
      await createOk({
        technicianId: techA.id,
        scheduledStart: at("12:00", day),
        scheduledEnd: at("13:00", day),
      });
      await createOk({
        technicianId: techB.id,
        scheduledStart: at("10:30", day),
        scheduledEnd: at("11:30", day),
      });
    });

    it("re-runs the check on assign and reschedule", async () => {
      const job = await createOk({
        scheduledStart: at("10:15", day),
        scheduledEnd: at("11:00", day),
      });
      const assign = await patch(job.id, { version: job.version, technicianId: techA.id });
      expect(assign.status).toBe(409);

      const moved = await patch(job.id, {
        version: job.version,
        scheduledStart: at("15:00", day),
        scheduledEnd: at("16:00", day),
        technicianId: techA.id,
      });
      expect(moved.status).toBe(200);
      const scheduled = await moved.json();
      expect(scheduled.status).toBe("scheduled");

      const back = await patch(job.id, {
        version: scheduled.version,
        scheduledStart: at("09:00", day),
        scheduledEnd: at("10:30", day),
      });
      expect(back.status).toBe(409);
    });

    it("ignores the job's own window when it is rescheduled", async () => {
      const response = await patch(booked.id, {
        version: 0,
        scheduledStart: at("10:00", day),
        scheduledEnd: at("11:30", day),
      });
      expect(response.status).toBe(200);
    });

    it("doesn't count cancelled jobs", async () => {
      const job = await createOk({
        technicianId: techB.id,
        scheduledStart: at("18:00", day),
        scheduledEnd: at("19:00", day),
      });
      expect(
        (await status(job.id, { to: "cancelled", reason: "Customer away" }, owner)).status,
      ).toBe(200);
      await createOk({
        technicianId: techB.id,
        scheduledStart: at("18:00", day),
        scheduledEnd: at("19:00", day),
      });
    });

    it("lets only one of two simultaneous bookings through", async () => {
      const window = {
        technicianId: techB.id,
        scheduledStart: at("08:00", "2030-03-06"),
        scheduledEnd: at("09:00", "2030-03-06"),
      };
      const results = await Promise.all([create(window), create(window), create(window)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409]);
    });

    it("refuses inactive or non-technician users", async () => {
      const dispatcher = await addMember(owner, "dispatcher");
      const response = await create({
        technicianId: dispatcher.id,
        scheduledStart: at("20:00", day),
        scheduledEnd: at("21:00", day),
      });
      expect(response.status).toBe(400);
    });
  });

  it("returns 409 for a stale version (FR-JOB-06)", async () => {
    const job = await createOk({ scheduledStart: at("14:00"), scheduledEnd: at("15:00") });
    expect((await patch(job.id, { version: 0, title: "First edit" })).status).toBe(200);
    const stale = await patch(job.id, { version: 0, title: "Second edit" });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("VERSION_CONFLICT");
  });

  it("unassigns when the technician is removed", async () => {
    const job = await createOk({
      technicianId: techA.id,
      scheduledStart: at("16:00"),
      scheduledEnd: at("17:00"),
    });
    const response = await patch(job.id, { version: job.version, technicianId: null });
    expect((await response.json()).status).toBe("unassigned");
  });

  describe("technician access (NFR-SEC-03)", () => {
    let jobOfA: { id: string };

    beforeAll(async () => {
      jobOfA = await createOk({
        technicianId: techA.id,
        scheduledStart: at("07:00", "2030-03-07"),
        scheduledEnd: at("08:00", "2030-03-07"),
      });
    });

    it("gives 403 when a technician opens another technician's job by URL", async () => {
      const response = await getJobRoute(
        request(`/api/jobs/${jobOfA.id}`, { cookie: techB.cookie }),
        idContext(jobOfA.id),
      );
      expect(response.status).toBe(403);
      const own = await getJobRoute(
        request(`/api/jobs/${jobOfA.id}`, { cookie: techA.cookie }),
        idContext(jobOfA.id),
      );
      expect(own.status).toBe(200);
    });

    it("only lists the technician's own jobs, whatever the filter says", async () => {
      const response = await listJobsRoute(
        request(`/api/jobs?technicianId=${techA.id}&limit=100`, { cookie: techB.cookie }),
        undefined,
      );
      const { items } = await response.json();
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((j: { technicianId: string }) => j.technicianId === techB.id)).toBe(true);
    });

    it("doesn't let a technician start someone else's job or edit jobs", async () => {
      expect((await status(jobOfA.id, { to: "in_progress" }, techB.cookie)).status).toBe(403);
      expect((await patch(jobOfA.id, { version: 0, title: "Mine now" }, techA.cookie)).status).toBe(
        403,
      );
    });

    it("doesn't let another business see the job", async () => {
      const other = await createBusiness("Other Co");
      const response = await getJobRoute(
        request(`/api/jobs/${jobOfA.id}`, { cookie: other.cookie }),
        idContext(jobOfA.id),
      );
      expect(response.status).toBe(404);
    });
  });

  describe("technician flow (FR-TECH-01..03, FR-FILE-01..02)", () => {
    let job: { id: string };

    const upload = async (kind: "after" | "before" | "signature", cookie = techA.cookie) => {
      const signed = await signRoute(
        request("/api/uploads/sign", { method: "POST", cookie, body: { jobId: job.id, kind } }),
        undefined,
      );
      expect(signed.status).toBe(200);
      const params: UploadParams = await signed.json();
      const form = new FormData();
      for (const [k, v] of Object.entries(params.fields)) form.set(k, v);
      form.set(params.fileField, new Blob([PNG], { type: "image/png" }), "photo.png");
      const uploaded = await localUpload(
        new NextRequest(new URL(params.url, "http://localhost:3000"), {
          method: "POST",
          headers: { cookie: `${SESSION_COOKIE}=${cookie}` },
          body: form,
        }),
        undefined,
      );
      expect(uploaded.status).toBe(201);
      return params.key;
    };

    beforeAll(async () => {
      job = await createOk({
        technicianId: techA.id,
        scheduledStart: new Date(Date.now() + 60_000).toISOString(),
        scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
      });
    });

    it("shows the job on the technician's Today screen", async () => {
      const response = await techTodayRoute(
        request("/api/tech/today", { cookie: techA.cookie }),
        undefined,
      );
      const { items } = await response.json();
      expect(items.map((j: { id: string }) => j.id)).toContain(job.id);
    });

    it("can't complete before starting", async () => {
      const response = await status(job.id, { to: "completed" }, techA.cookie);
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("INVALID_TRANSITION");
    });

    it("starts, then needs an after photo and a signature to complete", async () => {
      const started = await status(job.id, { to: "in_progress" }, techA.cookie);
      expect(started.status).toBe(200);
      expect((await started.json()).startedAt).not.toBeNull();

      const tooSoon = await status(job.id, { to: "completed" }, techA.cookie);
      expect(tooSoon.status).toBe(422);

      const key = await upload("after");
      const photo = await postPhoto(
        request(`/api/jobs/${job.id}/photos`, {
          method: "POST",
          cookie: techA.cookie,
          body: { kind: "after", key, width: 1, height: 1, bytes: PNG.length },
        }),
        idContext(job.id),
      );
      expect(photo.status).toBe(201);

      const stillNoSignature = await status(job.id, { to: "completed" }, techA.cookie);
      expect((await stillNoSignature.json()).error.message).toMatch(/signature/);

      const signatureKey = await upload("signature");
      const signed = await putSignature(
        request(`/api/jobs/${job.id}/signature`, {
          method: "PUT",
          cookie: techA.cookie,
          body: { key: signatureKey },
        }),
        idContext(job.id),
      );
      expect(signed.status).toBe(200);

      const notes = await patchNotes(
        request(`/api/jobs/${job.id}/notes`, {
          method: "PATCH",
          cookie: techA.cookie,
          body: { notes: "Replaced the capacitor." },
        }),
        idContext(job.id),
      );
      expect(notes.status).toBe(200);

      const done = await status(job.id, { to: "completed" }, techA.cookie);
      expect(done.status).toBe(200);
      const completed = await done.json();
      expect(completed.completedAt).not.toBeNull();
      expect(completed.notes).toBe("Replaced the capacitor.");
    });

    it("records every change in the status history", async () => {
      const response = await getJobRoute(
        request(`/api/jobs/${job.id}`, { cookie: owner }),
        idContext(job.id),
      );
      const detail = await response.json();
      expect(detail.statusHistory.map((h: { to: string }) => h.to)).toEqual([
        "scheduled",
        "in_progress",
        "completed",
      ]);
      expect(detail.photos).toHaveLength(1);
    });

    it("locks a completed job", async () => {
      expect((await status(job.id, { to: "cancelled", reason: "Oops" }, owner)).status).toBe(409);
      expect((await patch(job.id, { version: 10, title: "Late edit" })).status).toBe(409);
    });

    it("rejects an upload key from another job", async () => {
      const other = await createOk({ scheduledStart: at("05:00"), scheduledEnd: at("05:30") });
      const response = await postPhoto(
        request(`/api/jobs/${other.id}/photos`, {
          method: "POST",
          cookie: owner,
          body: {
            kind: "after",
            key: `fieldops/${"a".repeat(24)}/${job.id}/after-0123456789abcdef`,
            width: 1,
            height: 1,
            bytes: 10,
          },
        }),
        idContext(other.id),
      );
      expect(response.status).toBe(400);
    });
  });

  it("needs a reason to cancel, and only office staff can cancel", async () => {
    const job = await createOk({
      technicianId: techA.id,
      scheduledStart: at("19:00"),
      scheduledEnd: at("20:00"),
    });
    expect((await status(job.id, { to: "cancelled" }, owner)).status).toBe(422);
    expect((await status(job.id, { to: "cancelled", reason: "No" }, techA.cookie)).status).toBe(
      403,
    );
    const cancelled = await status(
      job.id,
      { to: "cancelled", reason: "Customer cancelled" },
      owner,
    );
    expect((await cancelled.json()).cancelReason).toBe("Customer cancelled");
  });

  it("filters by status and finds a job by number (FR-JOB-07)", async () => {
    const job = await createOk({ scheduledStart: at("21:00"), scheduledEnd: at("22:00") });
    const byNumber = await listJobsRoute(
      request(`/api/jobs?q=${job.number.toLowerCase()}`, { cookie: owner }),
      undefined,
    );
    expect((await byNumber.json()).items.map((j: { id: string }) => j.id)).toEqual([job.id]);

    const byStatus = await listJobsRoute(
      request("/api/jobs?status=cancelled&limit=100", { cookie: owner }),
      undefined,
    );
    const items = (await byStatus.json()).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((j: { status: string }) => j.status === "cancelled")).toBe(true);
  });

  it("pages through jobs with the cursor without repeats", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `/api/jobs?limit=3${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await listJobsRoute(request(query, { cookie: owner }), undefined);
      const body: { items: { id: string }[]; nextCursor: string | null } = await response.json();
      seen.push(...body.items.map((j) => j.id));
      cursor = body.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(10);
  });
});
