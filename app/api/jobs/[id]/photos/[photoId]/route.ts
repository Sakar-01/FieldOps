import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { route } from "@/lib/http/route";
import { deletePhoto } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";

type Context = { params: Promise<{ id: string; photoId: string }> };

export const DELETE = route<Context>(async (req, { params }) => {
  const ctx = await requireRole(req);
  const { id, photoId } = await params;
  const jobId = new ObjectId(objectIdSchema.parse(id));
  const photo = new ObjectId(objectIdSchema.parse(photoId));
  await enforceRateLimit("write", ctx.userId.toHexString());
  await deletePhoto(ctx, jobId, photo);
  return new NextResponse(null, { status: 204 });
});
