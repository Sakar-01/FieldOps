import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { BusinessDoc, CustomerDoc, JobDoc, PhotoDoc, UserDoc } from "@/lib/db/types";
import type { DemoData } from "@/lib/demo/generate";

/**
 * Cross-tenant operations for the seed script and the daily cron only. Nothing reachable by a
 * user calls these; every user-facing query lives in a repository scoped by businessId.
 */
export const systemRepo = {
  async findDemoBusinesses(): Promise<BusinessDoc[]> {
    return (await getDb()).collection<BusinessDoc>("businesses").find({ isDemo: true }).toArray();
  },

  /** Storage keys of every file a business's photos and signatures point at. */
  async fileKeysOf(businessId: ObjectId): Promise<string[]> {
    const db = await getDb();
    const [photos, jobs] = await Promise.all([
      db
        .collection<PhotoDoc>("photos")
        .find({ businessId }, { projection: { key: 1 } })
        .toArray(),
      db
        .collection<JobDoc>("jobs")
        .find({ businessId, signature: { $ne: null } }, { projection: { "signature.key": 1 } })
        .toArray(),
    ]);
    return [...photos.map((p) => p.key), ...jobs.map((j) => j.signature!.key)];
  },

  async deleteBusiness(businessId: ObjectId): Promise<void> {
    const db = await getDb();
    await Promise.all([
      db.collection("photos").deleteMany({ businessId }),
      db.collection("jobs").deleteMany({ businessId }),
      db.collection("customers").deleteMany({ businessId }),
      db.collection("users").deleteMany({ businessId }),
    ]);
    await db.collection("businesses").deleteOne({ _id: businessId });
  },

  async insertDemo(data: DemoData): Promise<void> {
    const db = await getDb();
    await db.collection<BusinessDoc>("businesses").insertOne(data.business);
    await db.collection<UserDoc>("users").insertMany(data.users);
    await db.collection<CustomerDoc>("customers").insertMany(data.customers);
    await db.collection<JobDoc>("jobs").insertMany(data.jobs);
  },

  /** Every storage key still referenced anywhere, for orphan cleanup. */
  async allReferencedKeys(): Promise<Set<string>> {
    const db = await getDb();
    const [photos, jobs] = await Promise.all([
      db
        .collection<PhotoDoc>("photos")
        .find({}, { projection: { key: 1 } })
        .toArray(),
      db
        .collection<JobDoc>("jobs")
        .find({ signature: { $ne: null } }, { projection: { "signature.key": 1 } })
        .toArray(),
    ]);
    return new Set([...photos.map((p) => p.key), ...jobs.map((j) => j.signature!.key)]);
  },
};
