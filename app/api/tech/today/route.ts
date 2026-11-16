import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { route } from "@/lib/http/route";
import { techToday } from "@/lib/services/jobs";

export const GET = route(async (req) => {
  const ctx = await requireRole(req, ["technician"]);
  return NextResponse.json(await techToday(ctx));
});
