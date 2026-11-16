import { NextResponse } from "next/server";
import { OFFICE_ROLES, OWNER_ONLY, requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { addMember, listTeam } from "@/lib/services/team";
import { addMemberSchema, listTeamQuerySchema } from "@/lib/validators/team";

export const GET = route(async (req) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const filter = listTeamQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json({ items: await listTeam(ctx, filter) });
});

export const POST = route(async (req) => {
  const ctx = await requireRole(req, OWNER_ONLY);
  const input = addMemberSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await addMember(ctx, input), { status: 201 });
});
