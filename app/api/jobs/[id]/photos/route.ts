import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { addPhoto } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";
import { savePhotoSchema } from "@/lib/validators/jobs";

/** Saves metadata after the browser has uploaded the file straight to storage. */
export const POST = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req);
  const id = objectIdSchema.parse((await params).id);
  const input = savePhotoSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await addPhoto(ctx, new ObjectId(id), input), { status: 201 });
});
