import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookie";

// Where requirePageRole() sends a session that is no longer valid. Needs to be a GET
// because it's reached through a redirect; the logout button uses POST /api/auth/logout.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookie(response);
  return response;
}
