import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { changeStatus } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";
import { changeStatusSchema } from "@/lib/validators/jobs";

/** Who may make which change is decided by the state machine, not here. */
export const POST = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req);
  const id = objectIdSchema.parse((await params).id);
  const input = changeStatusSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await changeStatus(ctx, new ObjectId(id), input));
});
