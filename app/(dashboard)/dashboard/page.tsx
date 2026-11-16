import { AlertTriangleIcon, CalendarIcon, CheckCircle2Icon, WrenchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CompletedChart } from "@/components/dashboard/completed-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { formatWindow } from "@/lib/domain/time";
import { getDashboard } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export default async function DashboardPage() {
  const { context } = await requirePageRole(OFFICE_ROLES);
  const data = await getDashboard(context);

  const cards = [
    { label: "Jobs today", value: data.cards.today, icon: CalendarIcon, href: "/jobs" },
    {
      label: "In progress",
      value: data.cards.inProgress,
      icon: WrenchIcon,
      href: "/jobs?status=in_progress",
    },
    {
      label: "Completed this week",
      value: data.cards.completedThisWeek,
      icon: CheckCircle2Icon,
      href: "/jobs?status=completed",
    },
    {
      label: "Overdue",
      value: data.cards.overdue,
      icon: AlertTriangleIcon,
      href: "/jobs?status=scheduled",
      alert: data.cards.overdue > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* FR-DASH-01 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl focus-visible:ring-2">
            <Card className="hover:bg-muted/50 h-full gap-2 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription>{card.label}</CardDescription>
                <card.icon
                  aria-hidden
                  className={
                    card.alert ? "text-destructive size-4" : "text-muted-foreground size-4"
                  }
                />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Completed per technician this week</CardTitle>
            <CardDescription>Week starts Monday, {data.timezone}</CardDescription>
          </CardHeader>
          <CardContent>
            <CompletedChart data={data.completedPerTechnician} />
          </CardContent>
        </Card>

        {/* FR-DASH-03 */}
        <Card>
          <CardHeader>
            <CardTitle>Average completion time</CardTitle>
            <CardDescription>Start to complete, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data.avgCompletionMinutes === null ? (
              <p className="text-muted-foreground text-sm">
                No completed jobs in the last 30 days.
              </p>
            ) : (
              <>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatDuration(data.avgCompletionMinutes)}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Across {data.avgCompletionJobs} job{data.avgCompletionJobs === 1 ? "" : "s"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overdue jobs</CardTitle>
          <CardDescription>Scheduled jobs whose end time has passed, oldest first</CardDescription>
        </CardHeader>
        <CardContent>
          {data.overdue.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing overdue.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.overdue.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="font-medium underline">
                      {job.number}
                    </Link>{" "}
                    · {job.title} · {job.customerName}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatWindow(job.scheduledStart, job.scheduledEnd, data.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
