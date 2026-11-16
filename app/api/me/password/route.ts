import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { changePassword } from "@/lib/services/auth";
import { changePasswordSchema } from "@/lib/validators/auth";

export const POST = route(async (req) => {
  const ctx = await requireRole(req);
  const input = changePasswordSchema.parse(await readJson(req));
  // Same limit as login: this endpoint also checks a password.
  await enforceRateLimit("login", `password:${ctx.userId.toHexString()}`);
  await changePassword(ctx, input);
  return new NextResponse(null, { status: 204 });
});
