import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { JobDoc } from "@/lib/db/types";
import type { TimeWindow } from "@/lib/domain/overlap";

export interface DashboardFacets {
  today: { count: number }[];
  inProgress: { count: number }[];
  completedThisWeek: { count: number }[];
  overdueCount: { count: number }[];
  overdue: Pick<
    JobDoc,
    "_id" | "number" | "title" | "customerName" | "technicianId" | "scheduledStart" | "scheduledEnd"
  >[];
  perTechnician: { technicianId: ObjectId; name: string | null; completed: number }[];
  avgCompletion: { minutes: number; jobs: number }[];
}

export interface DashboardWindows {
  now: Date;
  today: TimeWindow;
  weekStart: Date;
  since30Days: Date;
}

/**
 * FR-DASH-01..03 in one aggregation (NFR-PERF-03). The first $match narrows to the jobs any
 * facet needs, and each $or branch is served by an index:
 *   active statuses        -> {businessId, status, scheduledStart}
 *   completed, last 30 days -> {businessId, status, completedAt}
 *   scheduled today        -> {businessId, scheduledStart, _id}
 */
export async function dashboardFacets(
  businessId: ObjectId,
  { now, today, weekStart, since30Days }: DashboardWindows,
): Promise<DashboardFacets> {
  const [result] = await (
    await getDb()
  )
    .collection<JobDoc>("jobs")
    .aggregate<DashboardFacets>([
      {
        $match: {
          businessId,
          $or: [
            { status: { $in: ["scheduled", "in_progress"] } },
            { status: "completed", completedAt: { $gte: since30Days } },
            { scheduledStart: { $gte: today.start, $lt: today.end } },
          ],
        },
      },
      {
        $facet: {
          today: [
            {
              $match: {
                scheduledStart: { $gte: today.start, $lt: today.end },
                status: { $ne: "cancelled" },
              },
            },
            { $count: "count" },
          ],
          inProgress: [{ $match: { status: "in_progress" } }, { $count: "count" }],
          completedThisWeek: [
            { $match: { status: "completed", completedAt: { $gte: weekStart } } },
            { $count: "count" },
          ],
          overdueCount: [
            { $match: { status: "scheduled", scheduledEnd: { $lt: now } } },
            { $count: "count" },
          ],
          overdue: [
            { $match: { status: "scheduled", scheduledEnd: { $lt: now } } },
            { $sort: { scheduledEnd: 1 } },
            { $limit: 10 },
            {
              $project: {
                number: 1,
                title: 1,
                customerName: 1,
                technicianId: 1,
                scheduledStart: 1,
                scheduledEnd: 1,
              },
            },
          ],
          perTechnician: [
            {
              $match: {
                status: "completed",
                completedAt: { $gte: weekStart },
                technicianId: { $ne: null },
              },
            },
            { $group: { _id: "$technicianId", completed: { $sum: 1 } } },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            {
              $project: {
                _id: 0,
                technicianId: "$_id",
                completed: 1,
                name: { $first: "$user.name" },
              },
            },
            { $sort: { completed: -1, name: 1 } },
          ],
          avgCompletion: [
            {
              $match: {
                status: "completed",
                completedAt: { $gte: since30Days },
                startedAt: { $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                minutes: {
                  $avg: {
                    $dateDiff: { startDate: "$startedAt", endDate: "$completedAt", unit: "minute" },
                  },
                },
                jobs: { $sum: 1 },
              },
            },
            { $project: { _id: 0, minutes: 1, jobs: 1 } },
          ],
        },
      },
    ])
    .toArray();
  return result;
}
