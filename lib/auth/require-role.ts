import type { NextRequest } from "next/server";
import type { Role } from "@/lib/db/types";
import { forbidden, unauthenticated } from "@/lib/http/errors";
import { recordRequestUser } from "@/lib/http/route";
import { SESSION_COOKIE } from "./constants";
import { resolveSession, type AuthContext } from "./session";

export const OFFICE_ROLES = ["owner", "dispatcher"] as const satisfies readonly Role[];
export const OWNER_ONLY = ["owner"] as const satisfies readonly Role[];

/** FR-AUTH-05: every API handler calls this; the proxy is not the only guard. */
export async function requireRole(req: NextRequest, roles?: readonly Role[]): Promise<AuthContext> {
  const session = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) throw unauthenticated();
  recordRequestUser(req, session.context.userId.toHexString());
  if (roles && !roles.includes(session.context.role)) throw forbidden();
  return session.context;
}
