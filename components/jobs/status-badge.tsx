import { AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/lib/db/types";
import { STATUS_LABELS, type JobStatus } from "@/lib/domain/job-status";
import { cn } from "cn";

// One fixed colour per status everywhere (UX rules). The text label is always shown too,
// so colour is never the only signal (NFR-A11Y-01).
const STATUS_STYLES: Record<JobStatus, string> = {
  unassigned: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  in_progress: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  cancelled: "bg-zinc-200 text-zinc-700 line-through dark:bg-zinc-800 dark:text-zinc-300",
};

export function StatusBadge({ status, overdue }: { status: JobStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge className={cn("border-transparent", STATUS_STYLES[status])}>
        {STATUS_LABELS[status]}
      </Badge>
      {overdue && (
        <Badge variant="destructive">
          <AlertTriangleIcon aria-hidden /> Overdue
        </Badge>
      )}
    </span>
  );
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant={priority === "urgent" ? "destructive" : "outline"}
      className={cn(
        priority === "high" && "border-orange-400 text-orange-700 dark:text-orange-300",
      )}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
