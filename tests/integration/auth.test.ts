import { beforeAll, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { GET as meRoute } from "@/app/api/me/route";
import { PATCH as patchMember } from "@/app/api/team/[id]/route";
import { GET as listTeamRoute, POST as addMemberRoute } from "@/app/api/team/route";
import { getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";
import {
  addMember,
  createBusiness,
  idContext,
  PASSWORD,
  request,
  sessionCookieFrom,
  uniqueEmail,
} from "../helpers/api";

const login = (email: string, password = PASSWORD) =>
  loginRoute(request("/api/auth/login", { method: "POST", body: { email, password } }), undefined);

beforeAll(async () => {
  await createIndexes(await getDb());
});

describe("signup (FR-AUTH-01)", () => {
  it("creates a business and owner and starts a session", async () => {
    const { cookie, business, user } = await createBusiness("Cool Air");
    expect(business.name).toBe("Cool Air");
    expect(business.timezone).toBe("Asia/Kolkata");
    expect(user.role).toBe("owner");

    const me = await meRoute(request("/api/me", { cookie }), undefined);
    expect(me.status).toBe(200);
    expect((await me.json()).user.id).toBe(user.id);
  });

  it("never returns the password hash", async () => {
    const { user } = await createBusiness();
    expect(JSON.stringify(user)).not.toContain("passwordHash");
  });

  it("sets an httpOnly, SameSite=Lax cookie", async () => {
    const response = await login((await createBusiness()).email);
    const header = response.headers.getSetCookie()[0].toLowerCase();
    expect(header).toContain("httponly");
    expect(header).toContain("samesite=lax");
  });

  it("rejects a duplicate email and leaves no orphan business behind", async () => {
    const { email } = await createBusiness();
    const businessName = `Copycat ${uniqueEmail()}`;

    const response = await signupRoute(
      request("/api/auth/signup", {
        method: "POST",
        body: { businessName, name: "Copy Cat", email, password: PASSWORD },
      }),
      undefined,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("EMAIL_TAKEN");
    // Matched by name because test files share one database and run in parallel.
    const db = await getDb();
    expect(await db.collection("businesses").countDocuments({ name: businessName })).toBe(0);
  });

  it("returns a 400 in the standard format for invalid input", async () => {
    const response = await signupRoute(
      request("/api/auth/signup", { method: "POST", body: { email: "nope" } }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a 400 rather than a 500 for malformed JSON", async () => {
    const req = request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const response = await signupRoute(req, undefined);
    expect(response.status).toBe(400);
  });
});

describe("login (FR-AUTH-02)", () => {
  it("accepts the right password, with any email casing", async () => {
    const { email, cookie } = await createBusiness();
    const response = await login(email.toUpperCase());
    expect(response.status).toBe(200);
    expect(sessionCookieFrom(response)).toBeTruthy();
    expect(cookie).toBeTruthy();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const { email } = await createBusiness();
    const wrong = await login(email, "wrong-password");
    const unknown = await login(uniqueEmail("ghost"));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });
});

describe("logout (FR-AUTH-03)", () => {
  it("expires the cookie", async () => {
    const response = await logoutRoute(request("/api/auth/logout", { method: "POST" }), undefined);
    expect(response.headers.getSetCookie()[0]).toMatch(/Max-Age=0/i);
  });
});

describe("handlers re-check the session (FR-AUTH-05)", () => {
  it("rejects no token and a bad token", async () => {
    expect((await meRoute(request("/api/me"), undefined)).status).toBe(401);
    expect((await meRoute(request("/api/me", { cookie: "garbage" }), undefined)).status).toBe(401);
  });

  it("enforces the role even for a logged-in user", async () => {
    const owner = await createBusiness();
    const tech = await addMember(owner.cookie, "technician");
    const techCookie = sessionCookieFrom(await login(tech.email));

    const list = await listTeamRoute(request("/api/team", { cookie: techCookie }), undefined);
    expect(list.status).toBe(403);
  });

  it("only lets the owner add members", async () => {
    const owner = await createBusiness();
    const dispatcher = await addMember(owner.cookie, "dispatcher");
    const cookie = sessionCookieFrom(await login(dispatcher.email));

    const response = await addMemberRoute(
      request("/api/team", {
        method: "POST",
        cookie,
        body: {
          name: "New Tech",
          email: uniqueEmail(),
          phone: "9876543210",
          role: "technician",
          temporaryPassword: PASSWORD,
        },
      }),
      undefined,
    );
    expect(response.status).toBe(403);
  });
});

describe("deactivation (FR-TEAM-02)", () => {
  async function setup() {
    const owner = await createBusiness();
    const tech = await addMember(owner.cookie, "technician");
    const techCookie = sessionCookieFrom(await login(tech.email));
    const response = await patchMember(
      request(`/api/team/${tech.id}`, {
        method: "PATCH",
        cookie: owner.cookie,
        body: { active: false },
      }),
      idContext(tech.id),
    );
    expect(response.status).toBe(200);
    return { tech, techCookie };
  }

  it("stops the user logging in", async () => {
    const { tech } = await setup();
    expect((await login(tech.email)).status).toBe(401);
  });

  it("ends a session that is already open, despite its still-valid JWT", async () => {
    const { techCookie } = await setup();
    const me = await meRoute(request("/api/me", { cookie: techCookie }), undefined);
    expect(me.status).toBe(401);
  });

  it("does not let the owner deactivate or demote the owner account", async () => {
    const owner = await createBusiness();
    for (const body of [{ active: false }, { role: "technician" }]) {
      const response = await patchMember(
        request(`/api/team/${owner.user.id}`, { method: "PATCH", cookie: owner.cookie, body }),
        idContext(owner.user.id),
      );
      expect(response.status).toBe(403);
    }
  });
});
