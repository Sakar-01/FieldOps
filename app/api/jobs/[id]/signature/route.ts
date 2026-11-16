import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route, type IdContext } from "@/lib/http/route";
import { saveSignature } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";
import { saveSignatureSchema } from "@/lib/validators/jobs";

export const PUT = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req, ["technician"]);
  const id = objectIdSchema.parse((await params).id);
  const { key } = saveSignatureSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await saveSignature(ctx, new ObjectId(id), key));
});
