import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";
import { isProduction } from "@/lib/env";
import { AppError } from "./errors";
import { logger } from "./logger";

export function handleError(error: unknown, requestId: string): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid input",
          details: { issues: error.issues.map((i) => ({ path: i.path, message: i.message })) },
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  // Standalone MongoDB can't run the booking transaction. Say so plainly in development.
  if (
    !isProduction() &&
    error instanceof MongoServerError &&
    /replica set member|Transaction numbers/i.test(error.message)
  ) {
    logger.error("mongo_not_replica_set", { requestId, message: error.message });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message:
            "MongoDB is not running as a replica set, so transactions fail. Run scripts/setup-local-mongo.ps1.",
          details: { requestId },
        },
      },
      { status: 500 },
    );
  }

  // Unknown failure: log everything, return nothing internal to the client.
  logger.error("unhandled_error", {
    requestId,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  });
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong", details: { requestId } } },
    { status: 500 },
  );
}
