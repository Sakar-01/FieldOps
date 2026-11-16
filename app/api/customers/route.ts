import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { createCustomer, listCustomers } from "@/lib/services/customers";
import { createCustomerSchema, listCustomersQuerySchema } from "@/lib/validators/customers";

export const GET = route(async (req) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const query = listCustomersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await listCustomers(ctx, query));
});

export const POST = route(async (req) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const input = createCustomerSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await createCustomer(ctx, input), { status: 201 });
});
