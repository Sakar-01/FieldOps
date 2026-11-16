import { ObjectId, type ClientSession } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { BusinessDoc } from "@/lib/db/types";

const collection = async () => (await getDb()).collection<BusinessDoc>("businesses");

export const businessesRepo = {
  async insert(input: Pick<BusinessDoc, "name" | "timezone">): Promise<BusinessDoc> {
    const doc: BusinessDoc = {
      _id: new ObjectId(),
      ...input,
      jobCounter: 0,
      isDemo: false,
      createdAt: new Date(),
    };
    await (await collection()).insertOne(doc);
    return doc;
  },

  async findById(businessId: ObjectId): Promise<BusinessDoc | null> {
    return (await collection()).findOne({ _id: businessId });
  },

  /** FR-JOB-02: $inc is atomic, so two jobs created at once never share a number. */
  async nextJobNumber(businessId: ObjectId, session?: ClientSession): Promise<number> {
    const business = await (
      await collection()
    ).findOneAndUpdate(
      { _id: businessId },
      { $inc: { jobCounter: 1 } },
      { returnDocument: "after", session, projection: { jobCounter: 1 } },
    );
    if (!business) throw new Error(`Business ${businessId.toHexString()} not found`);
    return business.jobCounter;
  },

  async remove(businessId: ObjectId): Promise<void> {
    await (await collection()).deleteOne({ _id: businessId });
  },
};
