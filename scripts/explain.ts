import type { Document } from "mongodb";
import { closeClient, getDb } from "@/lib/db/client";
import { DEMO_EMAILS } from "@/lib/demo/generate";

/**
 * NFR-PERF-02: runs the app's main queries against the seeded demo business with explain() and
 * prints the index each one used. Run `npm run seed` first, then `npm run explain`.
 */

interface PlanSummary {
  stages: string[];
  indexes: string[];
}

function summarise(plan: Document, out: PlanSummary = { stages: [], indexes: [] }): PlanSummary {
  if (!plan || typeof plan !== "object") return out;
  if (typeof plan.stage === "string") out.stages.push(plan.stage);
  if (typeof plan.indexName === "string") out.indexes.push(plan.indexName);
  for (const key of ["inputStage", "queryPlan", "winningPlan"]) {
    if (plan[key]) summarise(plan[key], out);
  }
  for (const child of plan.inputStages ?? []) summarise(child, out);
  return out;
}

/** Finds the first stage that carries a query planner (find or the aggregate's $cursor). */
function plannerOf(explain: Document): Document {
  if (explain.queryPlanner) return explain;
  for (const stage of explain.stages ?? []) if (stage.$cursor) return stage.$cursor;
  return explain;
}

async function main() {
  const db = await getDb();
  const owner = await db.collection("users").findOne({ email: DEMO_EMAILS.owner });
  const tech = await db.collection("users").findOne({ email: DEMO_EMAILS.technician });
  if (!owner || !tech) throw new Error("No demo data. Run `npm run seed` first.");
  const businessId = owner.businessId;
  const now = new Date();
  const dayStart = new Date(now.getTime() - 12 * 3_600_000);
  const dayEnd = new Date(now.getTime() + 12 * 3_600_000);
  const jobs = db.collection("jobs");
  const customers = db.collection("customers");
  const sample = await jobs.findOne({ businessId, status: "scheduled" });

  const queries: [string, () => Promise<Document>][] = [
    [
      "Overlap check (FR-JOB-05)",
      () =>
        jobs
          .find({
            businessId,
            technicianId: tech._id,
            status: { $in: ["scheduled", "in_progress"] },
            scheduledStart: { $lt: dayEnd },
            scheduledEnd: { $gt: dayStart },
          })
          .explain("executionStats"),
    ],
    [
      "Technician's day (FR-TECH-01)",
      () =>
        jobs
          .find({
            businessId,
            technicianId: tech._id,
            $or: [
              { scheduledStart: { $gte: dayStart, $lt: dayEnd }, status: { $ne: "cancelled" } },
              { status: "in_progress" },
            ],
          })
          .sort({ scheduledStart: 1 })
          .explain("executionStats"),
    ],
    [
      "Job list, default order",
      () =>
        jobs
          .find({ businessId })
          .sort({ scheduledStart: -1, _id: -1 })
          .limit(21)
          .explain("executionStats"),
    ],
    [
      "Job list, status filter",
      () =>
        jobs
          .find({ businessId, status: "scheduled" })
          .sort({ scheduledStart: -1, _id: -1 })
          .limit(21)
          .explain("executionStats"),
    ],
    [
      "Job list, technician filter",
      () =>
        jobs
          .find({ businessId, technicianId: tech._id })
          .sort({ scheduledStart: -1, _id: -1 })
          .limit(21)
          .explain("executionStats"),
    ],
    [
      "Job by number",
      () =>
        jobs.find({ businessId, number: sample?.number ?? "FO-0001" }).explain("executionStats"),
    ],
    [
      "Customer's jobs",
      () =>
        jobs
          .find({ businessId, customerId: sample?.customerId })
          .sort({ scheduledStart: -1, _id: -1 })
          .limit(11)
          .explain("executionStats"),
    ],
    [
      "Customer list",
      () => customers.find({ businessId }).sort({ _id: -1 }).limit(21).explain("executionStats"),
    ],
    [
      "Customer name search",
      () =>
        customers
          .find({ businessId, $text: { $search: "Sharma" } })
          .limit(21)
          .explain("executionStats"),
    ],
    [
      "Customer phone search",
      () =>
        customers
          .find({ businessId, phone: { $regex: "^98270" } })
          .sort({ _id: -1 })
          .limit(21)
          .hint({ businessId: 1, phone: 1 })
          .explain("executionStats"),
    ],
    [
      "Dashboard $match (NFR-PERF-03)",
      () =>
        jobs
          .aggregate([
            {
              $match: {
                businessId,
                $or: [
                  { status: { $in: ["scheduled", "in_progress"] } },
                  {
                    status: "completed",
                    completedAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) },
                  },
                  { scheduledStart: { $gte: dayStart, $lt: dayEnd } },
                ],
              },
            },
            { $count: "n" },
          ])
          .explain("executionStats"),
    ],
  ];

  const total = await jobs.countDocuments({ businessId });
  console.log(`Demo business: ${total} jobs\n`);
  console.log("| Query | Plan | Index | Keys examined | Docs examined | Returned |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const [name, run] of queries) {
    const explain = await run();
    const planner = plannerOf(explain);
    const { stages, indexes } = summarise(planner.queryPlanner?.winningPlan ?? {});
    const stats = planner.executionStats ?? explain.executionStats ?? {};
    const plan = [...new Set(stages)].reverse().join(" → ");
    if (stages.includes("COLLSCAN")) process.exitCode = 1;
    console.log(
      `| ${name} | ${plan} | ${[...new Set(indexes)].join(", ") || "-"} | ${stats.totalKeysExamined ?? "-"} | ${stats.totalDocsExamined ?? "-"} | ${stats.nReturned ?? "-"} |`,
    );
  }
  if (process.exitCode) console.error("\nA query used a collection scan.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
