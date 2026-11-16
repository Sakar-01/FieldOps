"use client";

import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/http/client";

/**
 * UX rule: a 409 shows the reason and a way forward. A stale version offers "Reload"; an overlap
 * links to the job that's in the way.
 */
export function showApiError(error: unknown, navigate?: (href: string) => void) {
  if (error instanceof ApiError && error.status === 409) {
    const details = error.details as { conflictingJobId?: string } | undefined;
    if (error.code === "JOB_OVERLAP" && details?.conflictingJobId && navigate) {
      const href = `/jobs/${details.conflictingJobId}`;
      toast.error(error.message, { action: { label: "View job", onClick: () => navigate(href) } });
      return;
    }
    toast.error(error.message, {
      action: { label: "Reload", onClick: () => window.location.reload() },
      duration: 10_000,
    });
    return;
  }
  toast.error(errorMessage(error));
}
