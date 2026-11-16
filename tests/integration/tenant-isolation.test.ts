import { beforeAll, describe, expect, it } from "vitest";
import { GET as getCustomerRoute, PATCH as patchCustomer } from "@/app/api/customers/[id]/route";
import { GET as listCustomersRoute, POST as postCustomer } from "@/app/api/customers/route";
import { PATCH as patchMember } from "@/app/api/team/[id]/route";
import { GET as listTeamRoute } from "@/app/api/team/route";
import { getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";
import { addMember, createBusiness, idContext, request, sampleCustomer } from "../helpers/api";

async function createCustomer(cookie: string, overrides: Record<string, unknown> = {}) {
  const response = await postCustomer(
    request("/api/customers", { method: "POST", cookie, body: sampleCustomer(overrides) }),
    undefined,
  );
  expect(response.status).toBe(201);
  return response.json();
}

describe("tenant isolation (NFR-SEC-02)", () => {
  let a: Awaited<ReturnType<typeof createBusiness>>;
  let b: Awaited<ReturnType<typeof createBusiness>>;
  let customerOfA: { id: string };

  beforeAll(async () => {
    await createIndexes(await getDb());
    a = await createBusiness("Business A");
    b = await createBusiness("Business B");
    customerOfA = await createCustomer(a.cookie, { name: "Private Customer" });
  });

  it("business B cannot read business A's customer", async () => {
    const response = await getCustomerRoute(
      request(`/api/customers/${customerOfA.id}`, { cookie: b.cookie }),
      idContext(customerOfA.id),
    );
    expect(response.status).toBe(404);
  });

  it("business A can read its own customer", async () => {
    const response = await getCustomerRoute(
      request(`/api/customers/${customerOfA.id}`, { cookie: a.cookie }),
      idContext(customerOfA.id),
    );
    expect(response.status).toBe(200);
  });

  it("business B cannot change business A's customer", async () => {
    const response = await patchCustomer(
      request(`/api/customers/${customerOfA.id}`, {
        method: "PATCH",
        cookie: b.cookie,
        body: { name: "Hacked" },
      }),
      idContext(customerOfA.id),
    );
    expect(response.status).toBe(404);

    const check = await getCustomerRoute(
      request(`/api/customers/${customerOfA.id}`, { cookie: a.cookie }),
      idContext(customerOfA.id),
    );
    expect((await check.json()).name).toBe("Private Customer");
  });

  it("business B's list and search never include business A's customers", async () => {
    for (const path of ["/api/customers", "/api/customers?q=Private"]) {
      const response = await listCustomersRoute(request(path, { cookie: b.cookie }), undefined);
      expect(response.status).toBe(200);
      expect((await response.json()).items).toEqual([]);
    }
  });

  it("ignores a businessId supplied in the request body", async () => {
    const created = await createCustomer(b.cookie, {
      name: "Smuggled",
      businessId: a.business.id,
    });
    const ownedByA = await getCustomerRoute(
      request(`/api/customers/${created.id}`, { cookie: a.cookie }),
      idContext(created.id),
    );
    expect(ownedByA.status).toBe(404);
  });

  it("business B cannot see or change business A's team", async () => {
    const tech = await addMember(a.cookie, "technician");

    const list = await listTeamRoute(request("/api/team", { cookie: b.cookie }), undefined);
    const ids = (await list.json()).items.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(tech.id);
    expect(ids).not.toContain(a.user.id);

    const patch = await patchMember(
      request(`/api/team/${tech.id}`, {
        method: "PATCH",
        cookie: b.cookie,
        body: { active: false },
      }),
      idContext(tech.id),
    );
    expect(patch.status).toBe(404);
  });
});

describe("customers (FR-CUST-01..03)", () => {
  let cookie: string;

  beforeAll(async () => {
    await createIndexes(await getDb());
    cookie = (await createBusiness("Search Co")).cookie;
    await createCustomer(cookie, { name: "Anita Sharma", phone: "9111111111" });
    await createCustomer(cookie, { name: "Vikram Singh", phone: "9222222222" });
  });

  const search = async (query: string) => {
    const response = await listCustomersRoute(
      request(`/api/customers?${query}`, { cookie }),
      undefined,
    );
    expect(response.status).toBe(200);
    return response.json();
  };

  it("finds customers by name", async () => {
    const { items } = await search("q=Anita");
    expect(items.map((c: { name: string }) => c.name)).toEqual(["Anita Sharma"]);
  });

  it("finds customers by phone prefix, however the number is typed", async () => {
    const { items } = await search(`q=${encodeURIComponent("92222 2")}`);
    expect(items.map((c: { name: string }) => c.name)).toEqual(["Vikram Singh"]);
  });

  it("treats regex characters in a search as plain text", async () => {
    const { items } = await search(`q=${encodeURIComponent("+.*")}`);
    expect(items).toEqual([]);
  });

  it("pages through every customer exactly once with the cursor", async () => {
    const pageCookie = (await createBusiness("Paging Co")).cookie;
    for (let i = 0; i < 5; i++) {
      await createCustomer(pageCookie, { name: `Customer ${i}` });
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = `/api/customers?limit=2${cursor ? `&cursor=${cursor}` : ""}`;
      const response = await listCustomersRoute(request(query, { cookie: pageCookie }), undefined);
      const body: { items: { id: string }[]; nextCursor: string | null } = await response.json();
      seen.push(...body.items.map((c) => c.id));
      cursor = body.nextCursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("keeps an address ID stable when the customer is edited", async () => {
    const created = await createCustomer(cookie);
    const [address] = created.addresses;

    const response = await patchCustomer(
      request(`/api/customers/${created.id}`, {
        method: "PATCH",
        cookie,
        body: { addresses: [{ ...address, city: "Bhopal" }] },
      }),
      idContext(created.id),
    );
    const updated = await response.json();
    expect(updated.addresses[0].id).toBe(address.id);
    expect(updated.addresses[0].city).toBe("Bhopal");
  });

  it("rejects a malformed ID with a 400", async () => {
    const response = await getCustomerRoute(
      request("/api/customers/not-an-id", { cookie }),
      idContext("not-an-id"),
    );
    expect(response.status).toBe(400);
  });
});
