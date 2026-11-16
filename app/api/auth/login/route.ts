import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookie";
import { clientIp, enforceRateLimit } from "@/lib/http/rate-limit";
import { readJson, route } from "@/lib/http/route";
import { login } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validators/auth";

export const POST = route(async (req) => {
  const input = loginSchema.parse(await readJson(req));
  await enforceRateLimit("login", `${clientIp(req.headers)}:${input.email}`);

  const { user, token } = await login(input);
  const response = NextResponse.json({ user });
  setSessionCookie(response, token);
  return response;
});
