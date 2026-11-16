import { ObjectId, type ClientSession, type Filter } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { Role, UserDoc } from "@/lib/db/types";

const collection = async () => (await getDb()).collection<UserDoc>("users");

export type NewUser = Omit<UserDoc, "_id" | "createdAt" | "lastLoginAt" | "active">;
export type UserPatch = Partial<Pick<UserDoc, "name" | "phone" | "role" | "active">>;

export const usersRepo = {
  async insert(input: NewUser): Promise<UserDoc> {
    const doc: UserDoc = {
      _id: new ObjectId(),
      ...input,
      active: true,
      createdAt: new Date(),
      lastLoginAt: null,
    };
    await (await collection()).insertOne(doc);
    return doc;
  },

  /** Unscoped on purpose: login is the one lookup that happens before a tenant is known. */
  async findByEmailForLogin(email: string): Promise<UserDoc | null> {
    return (await collection()).findOne({ email });
  },

  async findById(businessId: ObjectId, userId: ObjectId): Promise<UserDoc | null> {
    return (await collection()).findOne({ _id: userId, businessId });
  },

  async list(businessId: ObjectId, filter: { role?: Role; active?: boolean }): Promise<UserDoc[]> {
    const query: Filter<UserDoc> = { businessId };
    if (filter.role) query.role = filter.role;
    if (filter.active !== undefined) query.active = filter.active;
    return (await collection()).find(query).sort({ name: 1 }).limit(200).toArray();
  },

  async update(businessId: ObjectId, userId: ObjectId, patch: UserPatch): Promise<UserDoc | null> {
    return (await collection()).findOneAndUpdate(
      { _id: userId, businessId },
      { $set: patch },
      { returnDocument: "after" },
    );
  },

  /**
   * Claims a technician's schedule inside a booking transaction. Two transactions that both
   * write this document conflict, so concurrent bookings for one technician can't both pass
   * the overlap check. Returns null unless the user is an active technician.
   */
  async claimSchedule(
    businessId: ObjectId,
    technicianId: ObjectId,
    session: ClientSession,
  ): Promise<UserDoc | null> {
    return (await collection()).findOneAndUpdate(
      { _id: technicianId, businessId, role: "technician", active: true },
      { $inc: { scheduleVersion: 1 } },
      { returnDocument: "after", session },
    );
  },

  async namesByIds(businessId: ObjectId, ids: ObjectId[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await (
      await collection()
    )
      .find({ businessId, _id: { $in: ids } }, { projection: { name: 1 } })
      .toArray();
    return new Map(users.map((u) => [u._id.toHexString(), u.name]));
  },

  async setPassword(businessId: ObjectId, userId: ObjectId, passwordHash: string): Promise<void> {
    await (await collection()).updateOne({ _id: userId, businessId }, { $set: { passwordHash } });
  },

  async touchLastLogin(businessId: ObjectId, userId: ObjectId): Promise<void> {
    await (
      await collection()
    ).updateOne({ _id: userId, businessId }, { $set: { lastLoginAt: new Date() } });
  },
};
