import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, unauthenticated } from "@/lib/http/errors";
import { logger } from "@/lib/http/logger";
import { route } from "@/lib/http/route";
import { cleanupOrphanUploads, resetDemo } from "@/lib/services/demo";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Vercel's daily cron (vercel.json) sends Authorization: Bearer CRON_SECRET. "Overdue" is
 * computed when read, so there is nothing to mark; the job resets the demo and removes uploads
 * that were never attached to a job.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new AppError(503, "INTERNAL", "CRON_SECRET is not set");
  const given = req.headers.get("authorization") ?? "";
  // Hashing first gives equal lengths, so the comparison is constant-time.
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) throw unauthenticated();

  const demo = await resetDemo();
  const uploads = await cleanupOrphanUploads();
  logger.info("cron_daily", { demo, uploads });
  return NextResponse.json({ demo, uploads });
});
