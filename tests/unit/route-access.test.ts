import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/auth/route-access";

describe("decideAccess (FR-AUTH-04)", () => {
  it("sends anonymous visitors to /login", () => {
    expect(decideAccess("/dashboard", null)).toEqual({ type: "redirect", to: "/login" });
    expect(decideAccess("/tech/today", null)).toEqual({ type: "redirect", to: "/login" });
  });

  it("lets anonymous visitors reach public pages and APIs", () => {
    for (const path of ["/", "/login", "/signup", "/api-docs", "/api/auth/login", "/api/openapi"]) {
      expect(decideAccess(path, null)).toEqual({ type: "allow" });
    }
  });

  it("sends signed-in users from the landing page to their home", () => {
    expect(decideAccess("/", "owner")).toEqual({ type: "redirect", to: "/dashboard" });
    expect(decideAccess("/", "technician")).toEqual({ type: "redirect", to: "/tech/today" });
  });

  it("answers anonymous API calls with 401 rather than a redirect", () => {
    expect(decideAccess("/api/customers", null)).toEqual({ type: "unauthorized" });
    expect(decideAccess("/api/me", null)).toEqual({ type: "unauthorized" });
  });

  it("does not treat a look-alike path as a public one", () => {
    expect(decideAccess("/api/auth/signup-admin", null)).toEqual({ type: "unauthorized" });
    expect(decideAccess("/teams", "technician")).toEqual({ type: "allow" });
  });

  it("keeps technicians out of office pages", () => {
    for (const path of ["/dashboard", "/jobs", "/jobs/new", "/customers", "/team"]) {
      expect(decideAccess(path, "technician")).toEqual({ type: "redirect", to: "/tech/today" });
    }
  });

  it("keeps office roles out of technician pages", () => {
    expect(decideAccess("/tech/today", "owner")).toEqual({ type: "redirect", to: "/dashboard" });
    expect(decideAccess("/tech/today", "dispatcher")).toEqual({
      type: "redirect",
      to: "/dashboard",
    });
  });

  it("limits /team to owners", () => {
    expect(decideAccess("/team", "owner")).toEqual({ type: "allow" });
    expect(decideAccess("/team", "dispatcher")).toEqual({ type: "redirect", to: "/dashboard" });
  });

  it("sends logged-in users away from login and signup", () => {
    expect(decideAccess("/login", "owner")).toEqual({ type: "redirect", to: "/dashboard" });
    expect(decideAccess("/signup", "technician")).toEqual({ type: "redirect", to: "/tech/today" });
  });
});
