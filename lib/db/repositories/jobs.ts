import { ObjectId, type ClientSession, type Filter, type UpdateFilter } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { JobDoc } from "@/lib/db/types";
import { ACTIVE_STATUSES, type JobStatus } from "@/lib/domain/job-status";
import type { TimeWindow } from "@/lib/domain/overlap";

const collection = async () => (await getDb()).collection<JobDoc>("jobs");

export interface JobSearch {
  status?: JobStatus;
  priority?: JobDoc["priority"];
  /** null finds unassigned jobs. */
  technicianId?: ObjectId | null;
  customerId?: ObjectId;
  from?: Date;
  to?: Date;
  number?: string;
  customerName?: string;
  cursor?: ObjectId;
  limit: number;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const jobsRepo = {
  async insert(doc: JobDoc, session?: ClientSession): Promise<void> {
    await (await collection()).insertOne(doc, { session });
  },

  async findById(businessId: ObjectId, id: ObjectId): Promise<JobDoc | null> {
    return (await collection()).findOne({ _id: id, businessId });
  },

  /**
   * The overlap rule from section 7: same technician, an active status, and windows that
   * intersect. Touching windows don't match because both comparisons are strict.
   */
  async findOverlap(
    businessId: ObjectId,
    technicianId: ObjectId,
    window: TimeWindow,
    excludeJobId: ObjectId | null,
    session?: ClientSession,
  ): Promise<JobDoc | null> {
    const query: Filter<JobDoc> = {
      businessId,
      technicianId,
      status: { $in: [...ACTIVE_STATUSES] },
      scheduledStart: { $lt: window.end },
      scheduledEnd: { $gt: window.start },
    };
    if (excludeJobId) query._id = { $ne: excludeJobId };
    return (await collection()).findOne(query, { session, sort: { scheduledStart: 1 } });
  },

  /** Optimistic lock (FR-JOB-06): matches only when nobody has saved since `version`. */
  async updateIfVersion(
    businessId: ObjectId,
    id: ObjectId,
    version: number,
    update: UpdateFilter<JobDoc>,
    session?: ClientSession,
  ): Promise<JobDoc | null> {
    return (await collection()).findOneAndUpdate(
      { _id: id, businessId, version },
      { ...update, $inc: { version: 1 } },
      { returnDocument: "after", session },
    );
  },

  /**
   * Status changes guard on the current status rather than a client version, so a technician's
   * phone doesn't need a fresh copy, but two conflicting changes still can't both apply.
   * Status and history go in one update (NFR-REL-02).
   */
  async updateIfStatus(
    businessId: ObjectId,
    id: ObjectId,
    status: JobStatus,
    update: UpdateFilter<JobDoc>,
  ): Promise<JobDoc | null> {
    return (await collection()).findOneAndUpdate(
      { _id: id, businessId, status },
      { ...update, $inc: { version: 1 } },
      { returnDocument: "after" },
    );
  },

  /** Returns up to limit + 1 rows, newest scheduled first. */
  async search(businessId: ObjectId, search: JobSearch): Promise<JobDoc[]> {
    const jobs = await collection();
    const query: Filter<JobDoc> = { businessId };
    if (search.status) query.status = search.status;
    if (search.priority) query.priority = search.priority;
    if (search.technicianId !== undefined) query.technicianId = search.technicianId;
    if (search.customerId) query.customerId = search.customerId;
    if (search.from || search.to) {
      query.scheduledStart = {
        ...(search.from && { $gte: search.from }),
        ...(search.to && { $lt: search.to }),
      };
    }
    if (search.number) query.number = search.number;
    if (search.customerName) {
      query.customerName = { $regex: escapeRegex(search.customerName), $options: "i" };
    }

    if (search.cursor) {
      // The cursor is a job ID; look up where it sits in the (scheduledStart, _id) order.
      const last = await jobs.findOne(
        { _id: search.cursor, businessId },
        { projection: { scheduledStart: 1 } },
      );
      if (last) {
        query.$or = [
          { scheduledStart: { $lt: last.scheduledStart } },
          { scheduledStart: last.scheduledStart, _id: { $lt: last._id } },
        ];
      }
    }

    return jobs
      .find(query)
      .sort({ scheduledStart: -1, _id: -1 })
      .limit(search.limit + 1)
      .toArray();
  },

  /** FR-TECH-01: the day's jobs, plus anything still in progress from an earlier day. */
  async forTechnicianDay(
    businessId: ObjectId,
    technicianId: ObjectId,
    day: TimeWindow,
  ): Promise<JobDoc[]> {
    return (await collection())
      .find({
        businessId,
        technicianId,
        $or: [
          { scheduledStart: { $gte: day.start, $lt: day.end }, status: { $ne: "cancelled" } },
          { status: "in_progress" },
        ],
      })
      .sort({ scheduledStart: 1 })
      .limit(100)
      .toArray();
  },
};
