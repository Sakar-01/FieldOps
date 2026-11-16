import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { handleError } from "./handle-error";
import { logger } from "./logger";

type Handler<TContext> = (req: NextRequest, context: TContext) => Promise<NextResponse>;

/** Context type for routes with a single dynamic [id] segment. */
export type IdContext = { params: Promise<{ id: string }> };

// Lets requireRole() record who is calling without threading it through every handler.
const requestUsers = new WeakMap<NextRequest, string>();
export const recordRequestUser = (req: NextRequest, userId: string) =>
  requestUsers.set(req, userId);

/** Wraps a Route Handler with a request ID, structured logging and handleError. */
export function route<TContext = unknown>(handler: Handler<TContext>): Handler<TContext> {
  return async (req, context) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    let response: NextResponse;
    try {
      response = await handler(req, context);
    } catch (error) {
      response = handleError(error, requestId);
    }
    response.headers.set("x-request-id", requestId);
    logger.info("request", {
      requestId,
      userId: requestUsers.get(req),
      method: req.method,
      route: req.nextUrl.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };
}

/** Malformed JSON becomes a 400 rather than an unhandled 500. */
export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Request body must be valid JSON");
  }
}
