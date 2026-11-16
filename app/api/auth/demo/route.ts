import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookie";
import { clientIp, enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { demoLogin } from "@/lib/services/demo";
import { demoLoginSchema } from "@/lib/validators/auth";

/** FR-AUTH-06: one click into the seeded demo business. */
export const POST = route(async (req) => {
  const { role } = demoLoginSchema.parse(await readJson(req));
  await enforceRateLimit("login", `demo:${clientIp(req.headers)}`);
  const { user, token } = await demoLogin(role);
  const response = NextResponse.json({ user });
  setSessionCookie(response, token);
  return response;
});
