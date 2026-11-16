import { ObjectId, type Filter } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { CustomerDoc } from "@/lib/db/types";

const collection = async () => (await getDb()).collection<CustomerDoc>("customers");

export type NewCustomer = Omit<CustomerDoc, "_id" | "businessId" | "createdAt" | "updatedAt">;
export type CustomerPatch = Partial<NewCustomer>;

export interface CustomerSearch {
  q?: string;
  cursor?: ObjectId;
  limit: number;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const looksLikePhone = (q: string) => /^\+?[\d\s-]+$/.test(q);

export const customersRepo = {
  async insert(businessId: ObjectId, input: NewCustomer): Promise<CustomerDoc> {
    const now = new Date();
    const doc: CustomerDoc = {
      _id: new ObjectId(),
      businessId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await (await collection()).insertOne(doc);
    return doc;
  },

  async findById(businessId: ObjectId, id: ObjectId): Promise<CustomerDoc | null> {
    return (await collection()).findOne({ _id: id, businessId });
  },

  /** Returns up to limit + 1 rows, so the caller can tell whether another page exists. */
  async search(businessId: ObjectId, { q, cursor, limit }: CustomerSearch): Promise<CustomerDoc[]> {
    const query: Filter<CustomerDoc> = { businessId };
    if (cursor) query._id = { $lt: cursor };
    if (q) {
      if (looksLikePhone(q)) {
        // Anchored prefix, so it can use the {businessId, phone} index.
        query.phone = { $regex: `^${escapeRegex(q.replace(/[\s-]/g, ""))}` };
      } else {
        query.$text = { $search: q };
      }
    }
    const cursorQuery = (await collection())
      .find(query)
      .sort({ _id: -1 })
      .limit(limit + 1);
    // A phone prefix matches few rows; without the hint the planner walks the _id index instead.
    if (query.phone) cursorQuery.hint({ businessId: 1, phone: 1 });
    return cursorQuery.toArray();
  },

  async update(
    businessId: ObjectId,
    id: ObjectId,
    patch: CustomerPatch,
  ): Promise<CustomerDoc | null> {
    return (await collection()).findOneAndUpdate(
      { _id: id, businessId },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  },
};
