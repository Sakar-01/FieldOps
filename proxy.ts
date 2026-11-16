import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifyToken } from "@/lib/auth/jwt";
import { decideAccess } from "@/lib/auth/route-access";

// The spec says middleware.ts; Next 16 renamed that convention to proxy.ts.
// This is a fast first gate only. It checks the signature, not the database:
// requireRole() and requirePageRole() make the authoritative decision.
export async function proxy(request: NextRequest) {
  const claims = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const decision = decideAccess(request.nextUrl.pathname, claims?.role ?? null);

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  if (decision.type === "unauthorized") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Please log in" } },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
