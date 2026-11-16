import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { OWNER_ONLY, requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { updateMember } from "@/lib/services/team";
import { objectIdSchema } from "@/lib/validators/common";
import { updateMemberSchema } from "@/lib/validators/team";

export const PATCH = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req, OWNER_ONLY);
  const id = objectIdSchema.parse((await params).id);
  const input = updateMemberSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await updateMember(ctx, new ObjectId(id), input));
});
