import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { PhotoDoc, PhotoKind } from "@/lib/db/types";

const collection = async () => (await getDb()).collection<PhotoDoc>("photos");

export type NewPhoto = Omit<PhotoDoc, "_id" | "createdAt">;

export const photosRepo = {
  async insert(input: NewPhoto): Promise<PhotoDoc> {
    const doc: PhotoDoc = { _id: new ObjectId(), ...input, createdAt: new Date() };
    await (await collection()).insertOne(doc);
    return doc;
  },

  async listForJob(businessId: ObjectId, jobId: ObjectId): Promise<PhotoDoc[]> {
    return (await collection()).find({ jobId, businessId }).sort({ createdAt: 1 }).toArray();
  },

  async countForJob(businessId: ObjectId, jobId: ObjectId, kind?: PhotoKind): Promise<number> {
    return (await collection()).countDocuments({ jobId, businessId, ...(kind && { kind }) });
  },

  async remove(businessId: ObjectId, jobId: ObjectId, photoId: ObjectId): Promise<PhotoDoc | null> {
    return (await collection()).findOneAndDelete({ _id: photoId, jobId, businessId });
  },
};
