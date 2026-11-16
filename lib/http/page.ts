import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/http/errors";
import { objectIdSchema } from "@/lib/validators/common";

/** For pages: a malformed ID or a 404 from the service becomes Next's not-found page. */
export function parseIdOr404(raw: string): ObjectId {
  const id = objectIdSchema.safeParse(raw);
  if (!id.success) notFound();
  return new ObjectId(id.data);
}

export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
