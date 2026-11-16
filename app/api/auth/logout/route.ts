import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookie";
import { route } from "@/lib/http/route";

export const POST = route(async () => {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
