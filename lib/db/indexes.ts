import type { Db, IndexDescription } from "mongodb";

/** Every tenant index starts with businessId, so scoped queries stay fast. */
export const INDEXES: Record<string, IndexDescription[]> = {
  users: [
    { key: { businessId: 1, email: 1 }, unique: true },
    // Deviation from the spec: login is by email alone, with no business picker,
    // so an email has to identify exactly one user across all businesses.
    { key: { email: 1 }, unique: true },
    { key: { businessId: 1, role: 1, active: 1 } },
  ],
  customers: [
    { key: { businessId: 1, _id: -1 } }, // default list, cursor pagination
    { key: { businessId: 1, phone: 1 } },
    { key: { businessId: 1, name: "text" } },
  ],
  jobs: [
    { key: { businessId: 1, number: 1 }, unique: true },
    // Overlap check, technician's day and the technician filter. Descending with _id so the
    // filtered job list reads them in its own order, with no in-memory sort.
    { key: { businessId: 1, technicianId: 1, scheduledStart: -1, _id: -1 } },
    { key: { businessId: 1, status: 1, scheduledStart: -1, _id: -1 } },
    // Dashboard: completed jobs in a time range.
    { key: { businessId: 1, status: 1, completedAt: 1 } },
    // Default job list order, and its cursor.
    { key: { businessId: 1, scheduledStart: -1, _id: -1 } },
    // Job history on the customer page.
    { key: { businessId: 1, customerId: 1, scheduledStart: -1, _id: -1 } },
  ],
  photos: [{ key: { jobId: 1, createdAt: 1 } }],
};

export async function createIndexes(db: Db): Promise<void> {
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    await db.collection(collection).createIndexes(indexes);
  }
}
