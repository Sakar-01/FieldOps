/** Browser-side API helper. Turns the standard error format into a thrown ApiError. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const { method = options.body === undefined ? "GET" : "POST", body } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? "INTERNAL",
      data?.error?.message ?? "Something went wrong",
      data?.error?.details,
    );
  }
  return data as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";
