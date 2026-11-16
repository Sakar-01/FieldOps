import type { Role } from "@/lib/db/types";

export const homeFor = (role: Role) => (role === "technician" ? "/tech/today" : "/dashboard");

const AUTH_PAGES = ["/login", "/signup"];
const PUBLIC_PAGES = ["/api-docs", "/logout"];
const PUBLIC_API = [
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/demo",
  "/api/openapi",
  "/api/cron",
];

const PAGE_ROLES: { prefix: string; roles: readonly Role[] }[] = [
  { prefix: "/team", roles: ["owner"] },
  { prefix: "/dashboard", roles: ["owner", "dispatcher"] },
  { prefix: "/jobs", roles: ["owner", "dispatcher"] },
  { prefix: "/customers", roles: ["owner", "dispatcher"] },
  { prefix: "/tech", roles: ["technician"] },
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export type AccessDecision =
  { type: "allow" } | { type: "redirect"; to: string } | { type: "unauthorized" };

/** Pure so it can be unit tested without a request. Used by proxy.ts (FR-AUTH-04). */
export function decideAccess(pathname: string, role: Role | null): AccessDecision {
  if (matches(pathname, "/api")) {
    if (PUBLIC_API.some((p) => matches(pathname, p))) return { type: "allow" };
    // Handlers check roles themselves; here we only need a JSON 401 rather than a redirect.
    return role ? { type: "allow" } : { type: "unauthorized" };
  }

  // Anonymous visitors get the public landing page; signed-in users go straight to work.
  if (pathname === "/") return role ? { type: "redirect", to: homeFor(role) } : { type: "allow" };
  if (AUTH_PAGES.some((p) => matches(pathname, p))) {
    return role ? { type: "redirect", to: homeFor(role) } : { type: "allow" };
  }
  if (PUBLIC_PAGES.some((p) => matches(pathname, p))) return { type: "allow" };

  if (!role) return { type: "redirect", to: "/login" };
  const rule = PAGE_ROLES.find((r) => matches(pathname, r.prefix));
  if (rule && !rule.roles.includes(role)) return { type: "redirect", to: homeFor(role) };
  return { type: "allow" };
}
