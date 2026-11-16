import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { createJob, listJobs } from "@/lib/services/jobs";
import { createJobSchema, listJobsQuerySchema } from "@/lib/validators/jobs";

/** Technicians get only their own jobs; the service enforces it. */
export const GET = route(async (req) => {
  const ctx = await requireRole(req);
  const query = listJobsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await listJobs(ctx, query));
});

export const POST = route(async (req) => {
  const ctx = await requireRole(req, OFFICE_ROLES);
  const input = createJobSchema.parse(await readJson(req));
  await enforceRateLimit("write", ctx.userId.toHexString());
  return NextResponse.json(await createJob(ctx, input), { status: 201 });
});
