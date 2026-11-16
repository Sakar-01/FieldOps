import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookie";
import { clientIp, enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { signup } from "@/lib/services/auth";
import { signupSchema } from "@/lib/validators/auth";

export const POST = route(async (req) => {
  const input = signupSchema.parse(await readJson(req));
  await enforceRateLimit("write", `signup:${clientIp(req.headers)}`);

  const { user, business, token } = await signup(input);
  const response = NextResponse.json({ user, business }, { status: 201 });
  setSessionCookie(response, token);
  return response;
});
