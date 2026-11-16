import { ObjectId } from "mongodb";
import { usersRepo } from "@/lib/db/repositories/users";
import type { Role, UserDoc } from "@/lib/db/types";
import { verifyToken } from "./jwt";

/** Passed to every service. businessId always comes from here, never a request (NFR-SEC-02). */
export interface AuthContext {
  userId: ObjectId;
  businessId: ObjectId;
  role: Role;
}

/**
 * Verifies the token, then confirms the user against the database. A JWT lasts 7 days,
 * so without this a deactivated user or a changed role would keep working until expiry.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<{ context: AuthContext; user: UserDoc } | null> {
  const claims = await verifyToken(token);
  if (!claims) return null;
  if (!ObjectId.isValid(claims.userId) || !ObjectId.isValid(claims.businessId)) return null;

  const user = await usersRepo.findById(
    new ObjectId(claims.businessId),
    new ObjectId(claims.userId),
  );
  if (!user || !user.active) return null;

  return { context: { userId: user._id, businessId: user.businessId, role: user.role }, user };
}
