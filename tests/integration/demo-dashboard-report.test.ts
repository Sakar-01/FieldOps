import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as demoRoute } from "@/app/api/auth/demo/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as cronRoute } from "@/app/api/cron/daily/route";
import { POST as postCustomer } from "@/app/api/customers/route";
import { GET as dashboardRoute } from "@/app/api/dashboard/route";
import { GET as reportRoute } from "@/app/api/jobs/[id]/report/route";
import { POST as postStatus } from "@/app/api/jobs/[id]/status/route";
import { GET as listJobs, POST as postJob } from "@/app/api/jobs/route";
import { POST as passwordRoute } from "@/app/api/me/password/route";
import { GET as openapiRoute } from "@/app/api/openapi/route";
import { PATCH as patchMember } from "@/app/api/team/[id]/route";
import { GET as teamRoute } from "@/app/api/team/route";
import { getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";
import type { JobDoc } from "@/lib/db/types";
import { DEMO_EMAILS } from "@/lib/demo/generate";
import { resetDemo } from "@/lib/services/demo";
import {
  addMember,
  createBusiness,
  idContext,
  PASSWORD,
  request,
  sampleCustomer,
  sessionCookieFrom,
} from "../helpers/api";

async function loginAs(email: string, password = PASSWORD) {
  return login(
    request("/api/auth/login", { method: "POST", body: { email, password } }),
    undefined,
  );
}

async function demo(role: "owner" | "technician") {
  const response = await demoRoute(
    request("/api/auth/demo", { method: "POST", body: { role } }),
    undefined,
  );
  expect(response.status).toBe(200);
  return sessionCookieFrom(response);
}

describe("demo data (FR-DEMO-01, FR-AUTH-06)", () => {
  beforeAll(async () => {
    await createIndexes(await getDb());
    await resetDemo();
  });

  it("seeds the business described in the spec", async () => {
    const owner = await demo("owner");
    const team = await (await teamRoute(request("/api/team", { cookie: owner }), undefined)).json();
    const roles = team.items.map((u: { role: string }) => u.role).sort();
    expect(roles).toEqual(["dispatcher", "owner", "technician", "technician", "technician"]);

    const db = await getDb();
    const business = await db.collection("businesses").findOne({ isDemo: true });
    expect(await db.collection("customers").countDocuments({ businessId: business!._id })).toBe(40);
    const jobs = await db.collection<JobDoc>("jobs").find({ businessId: business!._id }).toArray();
    expect(jobs.length).toBeGreaterThan(300);
    expect(new Set(jobs.map((j) => j.number)).size).toBe(jobs.length);
  });

  it("never seeds two active jobs that overlap for one technician", async () => {
    const db = await getDb();
    const business = await db.collection("businesses").findOne({ isDemo: true });
    const active = await db
      .collection<JobDoc>("jobs")
      .find({ businessId: business!._id, status: { $in: ["scheduled", "in_progress"] } })
      .sort({ technicianId: 1, scheduledStart: 1 })
      .toArray();
    for (let i = 1; i < active.length; i++) {
      const [a, b] = [active[i - 1], active[i]];
      if (a.technicianId?.equals(b.technicianId!)) {
        expect(b.scheduledStart >= a.scheduledEnd).toBe(true);
      }
    }
  });

  it("gives the demo technician jobs today", async () => {
    const tech = await demo("technician");
    const { GET } = await import("@/app/api/tech/today/route");
    const today = await (await GET(request("/api/tech/today", { cookie: tech }), undefined)).json();
    expect(today.items.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the demo accounts locked: no password change, no deactivation", async () => {
    const owner = await demo("owner");
    const change = await passwordRoute(
      request("/api/me/password", {
        method: "POST",
        cookie: owner,
        body: { currentPassword: "anything", newPassword: "new-password-123" },
      }),
      undefined,
    );
    expect(change.status).toBe(403);

    const team = await (await teamRoute(request("/api/team", { cookie: owner }), undefined)).json();
    const ravi = team.items.find((u: { email: string }) => u.email === DEMO_EMAILS.technician);
    const deactivate = await patchMember(
      request(`/api/team/${ravi.id}`, { method: "PATCH", cookie: owner, body: { active: false } }),
      idContext(ravi.id),
    );
    expect(deactivate.status).toBe(403);
  });

  it("can't be logged into with a password", async () => {
    expect((await loginAs(DEMO_EMAILS.owner, "password123")).status).toBe(401);
  });

  it("is replaced by a reset, and old demo sessions stop working", async () => {
    const before = await demo("owner");
    await resetDemo();
    const stale = await teamRoute(request("/api/team", { cookie: before }), undefined);
    expect(stale.status).toBe(401);
    const db = await getDb();
    expect(await db.collection("businesses").countDocuments({ isDemo: true })).toBe(1);
  });
});

describe("cron (FR-DEMO-02)", () => {
  it("needs the bearer secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const denied = await cronRoute(
      request("/api/cron/daily", { headers: { authorization: "Bearer wrong" } }),
      undefined,
    );
    expect(denied.status).toBe(401);
    const allowed = await cronRoute(
      request("/api/cron/daily", { headers: { authorization: "Bearer cron-test-secret" } }),
      undefined,
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).demo.customers).toBe(40);
  });
});

describe("password change", () => {
  it("replaces a temporary password", async () => {
    const { cookie } = await createBusiness("Password Co");
    const member = await addMember(cookie, "dispatcher");
    const memberCookie = sessionCookieFrom(await loginAs(member.email));

    const wrong = await passwordRoute(
      request("/api/me/password", {
        method: "POST",
        cookie: memberCookie,
        body: { currentPassword: "not-it", newPassword: "brand-new-pass" },
      }),
      undefined,
    );
    expect(wrong.status).toBe(400);

    const ok = await passwordRoute(
      request("/api/me/password", {
        method: "POST",
        cookie: memberCookie,
        body: { currentPassword: PASSWORD, newPassword: "brand-new-pass" },
      }),
      undefined,
    );
    expect(ok.status).toBe(204);
    expect((await loginAs(member.email)).status).toBe(401);
    expect((await loginAs(member.email, "brand-new-pass")).status).toBe(200);
  });
});

describe("dashboard and report (FR-DASH-01..03, FR-PDF-01)", () => {
  let owner: string;
  let tech: { id: string; cookie: string };
  let other: { id: string; cookie: string };
  let jobId: string;

  beforeAll(async () => {
    owner = (await createBusiness("Report Co")).cookie;
    const t = await addMember(owner, "technician");
    tech = { id: t.id, cookie: sessionCookieFrom(await loginAs(t.email)) };
    const o = await addMember(owner, "technician");
    other = { id: o.id, cookie: sessionCookieFrom(await loginAs(o.email)) };
    const customer = await (
      await postCustomer(
        request("/api/customers", { method: "POST", cookie: owner, body: sampleCustomer() }),
        undefined,
      )
    ).json();

    const now = Date.now();
    const created = await postJob(
      request("/api/jobs", {
        method: "POST",
        cookie: owner,
        body: {
          customerId: customer.id,
          addressId: customer.addresses[0].id,
          title: "Report job",
          technicianId: tech.id,
          scheduledStart: new Date(now - 30 * 60_000).toISOString(),
          scheduledEnd: new Date(now + 60 * 60_000).toISOString(),
        },
      }),
      undefined,
    );
    jobId = (await created.json()).id;
    // An overdue job: scheduled, already ended.
    await postJob(
      request("/api/jobs", {
        method: "POST",
        cookie: owner,
        body: {
          customerId: customer.id,
          addressId: customer.addresses[0].id,
          title: "Forgotten job",
          technicianId: other.id,
          scheduledStart: new Date(now - 3 * 3_600_000).toISOString(),
          scheduledEnd: new Date(now - 2 * 3_600_000).toISOString(),
        },
      }),
      undefined,
    );

    const status = (to: string) =>
      postStatus(
        request(`/api/jobs/${jobId}/status`, { method: "POST", cookie: tech.cookie, body: { to } }),
        idContext(jobId),
      );
    await status("in_progress");
    // Skip the upload round-trip: mark the proof directly, then complete through the API.
    const db = await getDb();
    const job = await db
      .collection<JobDoc>("jobs")
      .findOne({ number: { $exists: true }, title: "Report job" });
    await db.collection("photos").insertOne({
      businessId: job!.businessId,
      jobId: job!._id,
      kind: "after",
      key: "missing",
      url: "/x",
      width: 1,
      height: 1,
      bytes: 1,
      uploadedBy: job!.technicianId,
      createdAt: new Date(),
    });
    await db
      .collection<JobDoc>("jobs")
      .updateOne(
        { _id: job!._id },
        { $set: { signature: { key: "missing", url: "/x", signedAt: new Date() } } },
      );
    expect((await status("completed")).status).toBe(200);
  });

  it("summarises the business in one response", async () => {
    const response = await dashboardRoute(request("/api/dashboard", { cookie: owner }), undefined);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cards.completedThisWeek).toBe(1);
    expect(data.cards.overdue).toBe(1);
    expect(data.overdue[0].title).toBe("Forgotten job");
    expect(data.completedPerTechnician).toEqual([
      { technicianId: tech.id, name: "Test technician", completed: 1 },
    ]);
    expect(data.avgCompletionJobs).toBe(1);
    expect(data.avgCompletionMinutes).toBeGreaterThanOrEqual(0);
  });

  it("is not available to technicians", async () => {
    const response = await dashboardRoute(
      request("/api/dashboard", { cookie: tech.cookie }),
      undefined,
    );
    expect(response.status).toBe(403);
  });

  it("streams a PDF for a completed job, leaving out files it can't read", async () => {
    const response = await reportRoute(
      request(`/api/jobs/${jobId}/report`, { cookie: tech.cookie }),
      idContext(jobId),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses the report to another technician and for unfinished jobs", async () => {
    const response = await reportRoute(
      request(`/api/jobs/${jobId}/report`, { cookie: other.cookie }),
      idContext(jobId),
    );
    expect(response.status).toBe(403);

    const jobs = await (
      await listJobs(request("/api/jobs?status=scheduled", { cookie: owner }), undefined)
    ).json();
    const unfinished = jobs.items[0].id;
    const early = await reportRoute(
      request(`/api/jobs/${unfinished}/report`, { cookie: owner }),
      idContext(unfinished),
    );
    expect(early.status).toBe(422);
  });
});

describe("OpenAPI document (FR-DOCS-01)", () => {
  /** Every route.ts under app/api, as an OpenAPI path. */
  function apiRoutes(dir = path.join(process.cwd(), "app", "api")): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return apiRoutes(full);
      if (name !== "route.ts") return [];
      return [
        "/" +
          path
            .relative(path.join(process.cwd(), "app"), dir)
            .split(path.sep)
            .join("/")
            .replace(/\[([^\]]+)\]/g, "{$1}"),
      ];
    });
  }

  it("documents every API route except the dev-only upload stand-in", async () => {
    const response = await openapiRoute(request("/api/openapi"), undefined);
    const doc = await response.json();
    const documented = Object.keys(doc.paths);
    const missing = apiRoutes().filter(
      (p) => !p.startsWith("/api/uploads/local") && !documented.includes(p),
    );
    expect(missing).toEqual([]);
    expect(doc.paths["/api/jobs"].post.requestBody).toBeDefined();
  });
});
