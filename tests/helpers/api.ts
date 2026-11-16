import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { POST as addMemberRoute } from "@/app/api/team/route";

/** Calls real Route Handlers, so tests cover auth, validation and error mapping together. */
export function request(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string; headers?: HeadersInit } = {},
): NextRequest {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("cookie", `${SESSION_COOKIE}=${options.cookie}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function sessionCookieFrom(response: Response): string {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!header) throw new Error("Response did not set a session cookie");
  return header.split(";")[0].split("=")[1];
}

export const idContext = (id: string) => ({ params: Promise.resolve({ id }) });

let counter = 0;
export const uniqueEmail = (prefix = "user") => `${prefix}.${Date.now()}.${++counter}@example.com`;

export const PASSWORD = "correct-horse-battery";

export async function createBusiness(name = "Acme Cooling") {
  const email = uniqueEmail("owner");
  const response = await signupRoute(
    request("/api/auth/signup", {
      method: "POST",
      body: { businessName: name, name: "Olivia Owner", email, password: PASSWORD },
    }),
    undefined,
  );
  if (response.status !== 201) throw new Error(`Signup failed: ${response.status}`);
  const { user, business } = await response.json();
  return { cookie: sessionCookieFrom(response), user, business, email };
}

export async function addMember(ownerCookie: string, role: "dispatcher" | "technician") {
  const email = uniqueEmail(role);
  const response = await addMemberRoute(
    request("/api/team", {
      method: "POST",
      cookie: ownerCookie,
      body: { name: `Test ${role}`, email, phone: "9876543210", role, temporaryPassword: PASSWORD },
    }),
    undefined,
  );
  if (response.status !== 201) throw new Error(`Add member failed: ${response.status}`);
  return { ...(await response.json()), email };
}

export const sampleCustomer = (overrides: Record<string, unknown> = {}) => ({
  name: "Ramesh Kumar",
  phone: "98765 43210",
  addresses: [{ label: "Home", line1: "12 MG Road", city: "Indore", pincode: "452001" }],
  ...overrides,
});
