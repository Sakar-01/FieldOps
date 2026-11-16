import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/lib/db/types";
import { SESSION_COOKIE } from "./constants";
import { homeFor } from "./route-access";
import { resolveSession } from "./session";

/** For Server Components. Cached per request, so layout and page share one lookup. */
export const getCurrentSession = cache(async () => {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
});

export async function requirePageRole(roles?: readonly Role[]) {
  const session = await getCurrentSession();
  // A token can pass the proxy yet fail here, for example for a deactivated user.
  // /logout clears the cookie first, otherwise the proxy would bounce them straight back.
  if (!session) redirect("/logout");
  if (roles && !roles.includes(session.context.role)) redirect(homeFor(session.context.role));
  return session;
}
