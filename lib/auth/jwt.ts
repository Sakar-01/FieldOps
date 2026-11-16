import { jwtVerify, SignJWT } from "jose";
import { ROLES, type Role } from "@/lib/db/types";
import { getJwtSecret } from "@/lib/env";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

export interface TokenClaims {
  userId: string;
  businessId: string;
  role: Role;
}

export async function signToken(claims: TokenClaims): Promise<string> {
  return new SignJWT({ bid: claims.businessId, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

/** Returns null for anything invalid: bad signature, expired, wrong algorithm, wrong shape. */
export async function verifyToken(token: string | undefined): Promise<TokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
    const { sub, bid, role } = payload;
    if (typeof sub !== "string" || typeof bid !== "string") return null;
    if (!ROLES.includes(role as Role)) return null;
    return { userId: sub, businessId: bid, role: role as Role };
  } catch {
    return null;
  }
}
