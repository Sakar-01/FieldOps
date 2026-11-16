import { tz } from "@date-fns/tz";
import { startOfWeek, subDays } from "date-fns";
import type { AuthContext } from "@/lib/auth/session";
import { dashboardFacets } from "@/lib/db/repositories/dashboard";
import { todayWindow } from "@/lib/domain/time";
import { forbidden } from "@/lib/http/errors";
import { businessTimezone } from "./jobs";

export interface DashboardDto {
  timezone: string;
  cards: { today: number; inProgress: number; completedThisWeek: number; overdue: number };
  completedPerTechnician: { technicianId: string; name: string; completed: number }[];
  /** null when no job was completed in the last 30 days. */
  avgCompletionMinutes: number | null;
  avgCompletionJobs: number;
  overdue: {
    id: string;
    number: string;
    title: string;
    customerName: string;
    scheduledStart: string;
    scheduledEnd: string;
  }[];
}

const countOf = (rows: { count: number }[]) => rows[0]?.count ?? 0;

/** FR-DASH-01..03. "This week" starts on Monday in the business timezone. */
export async function getDashboard(ctx: AuthContext, now = new Date()): Promise<DashboardDto> {
  if (ctx.role === "technician") throw forbidden();
  const timezone = await businessTimezone(ctx);
  const weekStart = startOfWeek(now, { weekStartsOn: 1, in: tz(timezone) });

  const facets = await dashboardFacets(ctx.businessId, {
    now,
    today: todayWindow(timezone, now),
    weekStart: new Date(weekStart.getTime()),
    since30Days: subDays(now, 30),
  });

  const avg = facets.avgCompletion[0];
  return {
    timezone,
    cards: {
      today: countOf(facets.today),
      inProgress: countOf(facets.inProgress),
      completedThisWeek: countOf(facets.completedThisWeek),
      overdue: countOf(facets.overdueCount),
    },
    completedPerTechnician: facets.perTechnician.map((row) => ({
      technicianId: row.technicianId.toHexString(),
      name: row.name ?? "Former team member",
      completed: row.completed,
    })),
    avgCompletionMinutes: avg ? Math.round(avg.minutes) : null,
    avgCompletionJobs: avg?.jobs ?? 0,
    overdue: facets.overdue.map((job) => ({
      id: job._id.toHexString(),
      number: job.number,
      title: job.title,
      customerName: job.customerName,
      scheduledStart: job.scheduledStart.toISOString(),
      scheduledEnd: job.scheduledEnd.toISOString(),
    })),
  };
}
