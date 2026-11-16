import { STATUS_LABELS } from "@/lib/domain/job-status";
import { formatInZone } from "@/lib/domain/time";
import type { StatusChangeDto } from "@/lib/services/jobs";

/** Audit trail from the job's embedded status history (FR-JOB-04). */
export function StatusTimeline({
  history,
  timezone,
}: {
  history: StatusChangeDto[];
  timezone: string;
}) {
  return (
    <ol className="border-muted space-y-4 border-l-2 pl-4">
      {[...history].reverse().map((change, index) => (
        <li key={`${change.at}-${index}`} className="relative">
          <span
            aria-hidden
            className="bg-primary absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full"
          />
          <p className="text-sm font-medium">
            {change.from
              ? `${STATUS_LABELS[change.from]} → ${STATUS_LABELS[change.to]}`
              : `Created as ${STATUS_LABELS[change.to].toLowerCase()}`}
          </p>
          <p className="text-muted-foreground text-xs">
            {change.by} · {formatInZone(change.at, timezone, "d MMM yyyy, HH:mm")}
          </p>
          {change.reason && <p className="mt-1 text-sm">Reason: {change.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
