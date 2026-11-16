import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { getCustomer, updateCustomer } from "@/lib/services/customers";
import { objectIdSchema } from "@/lib/validators/common";
import { updateCustomerSchema } from "@/lib/validators/customers";

export const GET = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const id = objectIdSchema.parse((await params).id);
  return NextResponse.json(await getCustomer(ctx, new ObjectId(id)));
});

export const PATCH = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const id = objectIdSchema.parse((await params).id);
  const input = updateCustomerSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await updateCustomer(ctx, new ObjectId(id), input));
});
