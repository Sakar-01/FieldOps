import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { signUpload } from "@/lib/services/jobs";
import { signUploadSchema } from "@/lib/validators/jobs";

/** FR-FILE-01, NFR-SEC-04: short-lived params for one upload into the job's folder. */
export const POST = route(async (req) => {
  const ctx = await requireRole(req);
  const { jobId, kind } = signUploadSchema.parse(await readJson(req));
  await enforceRateLimit("uploadSign", ctx.userId.toHexString());
  return NextResponse.json(await signUpload(ctx, new ObjectId(jobId), kind));
});
