import type { ObjectId } from "mongodb";
import type { AuthContext } from "@/lib/auth/session";
import { usersRepo } from "@/lib/db/repositories/users";
import type { Role } from "@/lib/db/types";
import { emailTaken, forbidden, notFound } from "@/lib/http/errors";
import type { AddMemberInput, UpdateMemberInput } from "@/lib/validators/team";
import { hashPassword, isDuplicateKey, toUserDto } from "./auth";
import { isSeededDemoEmail } from "./demo";

export async function listTeam(ctx: AuthContext, filter: { role?: Role; active?: boolean } = {}) {
  const users = await usersRepo.list(ctx.businessId, filter);
  return users.map(toUserDto);
}

/** FR-TEAM-01 */
export async function addMember(ctx: AuthContext, input: AddMemberInput) {
  const passwordHash = await hashPassword(input.temporaryPassword);
  try {
    const user = await usersRepo.insert({
      businessId: ctx.businessId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      passwordHash,
    });
    return toUserDto(user);
  } catch (error) {
    if (isDuplicateKey(error)) throw emailTaken();
    throw error;
  }
}

/** FR-TEAM-02 */
export async function updateMember(ctx: AuthContext, id: ObjectId, input: UpdateMemberInput) {
  const target = await usersRepo.findById(ctx.businessId, id);
  if (!target) throw notFound("Team member");

  // Without this an owner could lock the whole business out, since nobody else can undo it.
  if (target.role === "owner" && (input.role !== undefined || input.active !== undefined)) {
    throw forbidden("The owner account can't be deactivated or given another role");
  }

  if (isSeededDemoEmail(target.email) && (input.role !== undefined || input.active !== undefined)) {
    throw forbidden("The demo's own accounts can't be deactivated or given another role");
  }

  const updated = await usersRepo.update(ctx.businessId, id, input);
  if (!updated) throw notFound("Team member");
  return toUserDto(updated);
}
