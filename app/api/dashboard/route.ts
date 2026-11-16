import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireRole } from "@/lib/auth/require-role";
import { route } from "@/lib/http/route";
import { getDashboard } from "@/lib/services/dashboard";

export const GET = route(async (req) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  return NextResponse.json(await getDashboard(ctx));
});
