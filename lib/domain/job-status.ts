import type { Role } from "@/lib/db/types";

/** Section 6 of the spec. Pure, so every rule is unit tested without a database. */
export const JOB_STATUSES = [
  "unassigned",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Statuses that occupy a technician's time, so they take part in the overlap check. */
export const ACTIVE_STATUSES = ["scheduled", "in_progress"] as const satisfies JobStatus[];
export const FINAL_STATUSES = ["completed", "cancelled"] as const satisfies JobStatus[];

export const isFinal = (status: JobStatus) =>
  (FINAL_STATUSES as readonly JobStatus[]).includes(status);

export const STATUS_LABELS: Record<JobStatus, string> = {
  unassigned: "Unassigned",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

type Actor = "office" | "assignedTechnician";

interface Rule {
  from: readonly JobStatus[];
  to: JobStatus;
  by: Actor;
}

const RULES: readonly Rule[] = [
  { from: ["unassigned"], to: "scheduled", by: "office" },
  { from: ["scheduled"], to: "unassigned", by: "office" },
  { from: ["scheduled"], to: "in_progress", by: "assignedTechnician" },
  { from: ["in_progress"], to: "completed", by: "assignedTechnician" },
  { from: ["unassigned", "scheduled", "in_progress"], to: "cancelled", by: "office" },
];

/** Everything a transition's conditions depend on, gathered by the service beforehand. */
export interface TransitionFacts {
  from: JobStatus;
  to: JobStatus;
  role: Role;
  /** The caller is the job's technician. */
  isAssignedTechnician: boolean;
  /** The job has (or will have, after this change) a technician. */
  hasTechnician: boolean;
  afterPhotoCount: number;
  hasSignature: boolean;
  reason?: string;
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_TRANSITION" | "FORBIDDEN" | "PRECONDITION"; message: string };

const fail = (code: "INVALID_TRANSITION" | "FORBIDDEN" | "PRECONDITION", message: string) =>
  ({ ok: false, code, message }) as const;

export function checkTransition(facts: TransitionFacts): TransitionResult {
  const { from, to } = facts;
  const rule = RULES.find((r) => r.to === to && r.from.includes(from));
  if (!rule) {
    return fail(
      "INVALID_TRANSITION",
      `A job can't go from ${STATUS_LABELS[from].toLowerCase()} to ${STATUS_LABELS[to].toLowerCase()}`,
    );
  }

  const isOffice = facts.role === "owner" || facts.role === "dispatcher";
  if (rule.by === "office" && !isOffice) {
    return fail("FORBIDDEN", "Only an owner or dispatcher can do this");
  }
  if (rule.by === "assignedTechnician" && !facts.isAssignedTechnician) {
    return fail("FORBIDDEN", "Only the assigned technician can do this");
  }

  switch (to) {
    case "scheduled":
      if (!facts.hasTechnician) return fail("PRECONDITION", "Assign a technician first");
      break;
    case "unassigned":
      if (facts.hasTechnician) return fail("PRECONDITION", "Remove the technician first");
      break;
    case "completed":
      if (facts.afterPhotoCount < 1) {
        return fail("PRECONDITION", "Add at least one after photo before completing");
      }
      if (!facts.hasSignature) {
        return fail("PRECONDITION", "Capture the customer's signature before completing");
      }
      break;
    case "cancelled":
      if (!facts.reason?.trim()) return fail("PRECONDITION", "Give a reason for cancelling");
      break;
  }
  return { ok: true };
}

/** The status a job should have after its technician is set or removed. */
export function statusForAssignment(current: JobStatus, hasTechnician: boolean): JobStatus {
  if (current === "unassigned" && hasTechnician) return "scheduled";
  if (current === "scheduled" && !hasTechnician) return "unassigned";
  return current;
}

/** "Overdue" is computed, never stored (section 6). */
export const isOverdue = (
  job: { status: JobStatus; scheduledEnd: Date | string },
  now = new Date(),
) => job.status === "scheduled" && new Date(job.scheduledEnd) < now;
