import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { usersRepo } from "@/lib/db/repositories/users";
import { businessesRepo } from "@/lib/db/repositories/businesses";
import { notFound } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { toBusinessDto, toUserDto } from "@/lib/services/auth";

export const GET = route(async (req) => {
  const ctx = await requireRole(req);
  const [user, business] = await Promise.all([
    usersRepo.findById(ctx.businessId, ctx.userId),
    businessesRepo.findById(ctx.businessId),
  ]);
  if (!user || !business) throw notFound("User");
  return NextResponse.json({ user: toUserDto(user), business: toBusinessDto(business) });
});
