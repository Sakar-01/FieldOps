import { describe, expect, it } from "vitest";
import {
  checkTransition,
  isOverdue,
  JOB_STATUSES,
  statusForAssignment,
  type JobStatus,
  type TransitionFacts,
} from "@/lib/domain/job-status";

// Facts under which every condition is satisfied, so only the rule under test can fail.
const happy = (overrides: Partial<TransitionFacts>): TransitionFacts => ({
  from: "unassigned",
  to: "scheduled",
  role: "owner",
  isAssignedTechnician: false,
  hasTechnician: true,
  afterPhotoCount: 1,
  hasSignature: true,
  reason: "Customer asked",
  ...overrides,
});

const ALLOWED: [JobStatus, JobStatus][] = [
  ["unassigned", "scheduled"],
  ["scheduled", "unassigned"],
  ["scheduled", "in_progress"],
  ["in_progress", "completed"],
  ["unassigned", "cancelled"],
  ["scheduled", "cancelled"],
  ["in_progress", "cancelled"],
];

const actorFor = (to: JobStatus): Partial<TransitionFacts> =>
  to === "in_progress" || to === "completed"
    ? { role: "technician", isAssignedTechnician: true }
    : { role: "dispatcher" };

describe("job status state machine (FR-JOB-04)", () => {
  // One test per pair, so the acceptance item "unit test per transition" is literal.
  for (const from of JOB_STATUSES) {
    for (const to of JOB_STATUSES) {
      const allowed = ALLOWED.some(([f, t]) => f === from && t === to);
      it(`${allowed ? "allows" : "rejects"} ${from} -> ${to}`, () => {
        const facts = happy({
          from,
          to,
          ...actorFor(to),
          hasTechnician: to !== "unassigned",
        });
        const result = checkTransition(facts);
        if (allowed) expect(result).toEqual({ ok: true });
        else expect(result).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
      });
    }
  }

  it("treats completed and cancelled as final", () => {
    for (const from of ["completed", "cancelled"] as const) {
      for (const to of JOB_STATUSES) {
        expect(checkTransition(happy({ from, to })).ok).toBe(false);
      }
    }
  });

  it("only lets the office assign, unassign and cancel", () => {
    expect(
      checkTransition(happy({ role: "technician", isAssignedTechnician: true })),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(
      checkTransition(
        happy({
          from: "scheduled",
          to: "cancelled",
          role: "technician",
          isAssignedTechnician: true,
        }),
      ),
    ).toMatchObject({ code: "FORBIDDEN" });
  });

  it("only lets the assigned technician start and complete", () => {
    expect(checkTransition(happy({ from: "scheduled", to: "in_progress" }))).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      checkTransition(
        happy({
          from: "scheduled",
          to: "in_progress",
          role: "technician",
          isAssignedTechnician: false,
        }),
      ),
    ).toMatchObject({ code: "FORBIDDEN" });
  });

  it("needs a technician to schedule and none to unassign", () => {
    expect(checkTransition(happy({ hasTechnician: false }))).toMatchObject({
      code: "PRECONDITION",
    });
    expect(
      checkTransition(happy({ from: "scheduled", to: "unassigned", hasTechnician: true })),
    ).toMatchObject({ code: "PRECONDITION" });
  });

  it("needs an after photo and a signature to complete (FR-TECH-02)", () => {
    const complete = { from: "in_progress", to: "completed", ...actorFor("completed") } as const;
    expect(checkTransition(happy({ ...complete, afterPhotoCount: 0 }))).toMatchObject({
      code: "PRECONDITION",
      message: expect.stringContaining("photo"),
    });
    expect(checkTransition(happy({ ...complete, hasSignature: false }))).toMatchObject({
      code: "PRECONDITION",
      message: expect.stringContaining("signature"),
    });
  });

  it("needs a reason to cancel (FR-JOB-08)", () => {
    for (const reason of [undefined, "", "   "]) {
      expect(checkTransition(happy({ from: "scheduled", to: "cancelled", reason }))).toMatchObject({
        code: "PRECONDITION",
      });
    }
  });
});

describe("statusForAssignment", () => {
  it("schedules an unassigned job when a technician is set, and reverses it", () => {
    expect(statusForAssignment("unassigned", true)).toBe("scheduled");
    expect(statusForAssignment("scheduled", false)).toBe("unassigned");
  });

  it("leaves other statuses alone", () => {
    expect(statusForAssignment("scheduled", true)).toBe("scheduled");
    expect(statusForAssignment("unassigned", false)).toBe("unassigned");
    expect(statusForAssignment("in_progress", true)).toBe("in_progress");
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  it("is true only for scheduled jobs whose end has passed", () => {
    expect(isOverdue({ status: "scheduled", scheduledEnd: "2026-11-14T09:59:00Z" }, now)).toBe(
      true,
    );
    expect(isOverdue({ status: "scheduled", scheduledEnd: "2026-11-14T10:30:00Z" }, now)).toBe(
      false,
    );
    expect(isOverdue({ status: "in_progress", scheduledEnd: "2026-11-14T09:00:00Z" }, now)).toBe(
      false,
    );
  });
});
