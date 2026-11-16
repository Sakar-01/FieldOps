import type { NextResponse } from "next/server";
import { isProduction } from "@/lib/env";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";

const baseOptions = () => ({
  httpOnly: true,
  // Off outside production so Docker and plain-http local dev still work.
  secure: isProduction(),
  sameSite: "lax" as const,
  path: "/",
});

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    ...baseOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...baseOptions(), maxAge: 0 });
}
