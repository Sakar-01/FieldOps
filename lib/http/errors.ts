export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "JOB_OVERLAP"
  | "VERSION_CONFLICT"
  | "INVALID_TRANSITION"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "Please log in") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You are not allowed to do this") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const emailTaken = () =>
  new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
export const versionConflict = () =>
  new AppError(
    409,
    "VERSION_CONFLICT",
    "Someone else changed this job since you opened it. Reload to see the latest version.",
  );
export const preconditionFailed = (message: string) =>
  new AppError(422, "PRECONDITION_FAILED", message);
export const invalidInput = (path: string, message: string) =>
  new AppError(400, "VALIDATION_ERROR", message, { issues: [{ path: [path], message }] });
