import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { updateNotes } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";
import { updateNotesSchema } from "@/lib/validators/jobs";

export const PATCH = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req, ["technician"]);
  const id = objectIdSchema.parse((await params).id);
  const { notes } = updateNotesSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await updateNotes(ctx, new ObjectId(id), notes));
});
