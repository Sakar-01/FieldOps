import { MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/jobs/status-badge";
import { mapsLink } from "@/components/tech/maps-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/current-user";
import { dayKey, formatInZone } from "@/lib/domain/time";
import { techToday } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Today" };

/** FR-TECH-01: today's jobs in time order, with the address and a maps link. */
export default async function TodayPage() {
  const { context } = await requirePageRole(["technician"]);
  const { items, timezone } = await techToday(context);
  const today = dayKey(new Date(), timezone);

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-xl font-semibold">Today&apos;s jobs</h1>
      {items.length === 0 && (
        <p className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
          No jobs for today. Check back later or ask your dispatcher.
        </p>
      )}
      <ul className="space-y-3">
        {items.map((job) => {
          const earlier = dayKey(job.scheduledStart, timezone) !== today;
          return (
            <li key={job.id}>
              <Card className="relative gap-3 py-4">
                <CardHeader className="px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link href={`/tech/jobs/${job.id}`} className="after:absolute after:inset-0">
                        {formatInZone(job.scheduledStart, timezone, "HH:mm")}–
                        {formatInZone(job.scheduledEnd, timezone, "HH:mm")} · {job.title}
                      </Link>
                    </CardTitle>
                    <StatusBadge status={job.status} overdue={job.overdue} />
                  </div>
                  {earlier && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Scheduled for {formatInZone(job.scheduledStart, timezone, "d MMM")}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 px-4 text-sm">
                  <p>
                    {job.number} · {job.customerName}
                  </p>
                  <p className="text-muted-foreground">
                    {job.address.line1}, {job.address.city} {job.address.pincode}
                  </p>
                  {/* Sits above the card-wide link, so both stay tappable. */}
                  <a
                    href={mapsLink(job.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-10 inline-flex min-h-11 items-center gap-1 font-medium underline"
                  >
                    <MapPinIcon className="size-4" aria-hidden /> Open in Maps
                  </a>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
