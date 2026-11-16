import type { Metadata } from "next";
import Link from "next/link";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobTable } from "@/components/jobs/job-table";
import { Button } from "@/components/ui/button";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { assignableTechnicians, businessTimezone, listJobs } from "@/lib/services/jobs";
import { listJobsQuerySchema } from "@/lib/validators/jobs";

export const metadata: Metadata = { title: "Jobs" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { context } = await requirePageRole(OFFICE_ROLES);

  // A hand-edited URL shouldn't produce an error page: fall back to no filters.
  const raw = await searchParams;
  const parsed = listJobsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listJobsQuerySchema.parse({});

  const [{ items, nextCursor }, technicians, timezone] = await Promise.all([
    listJobs(context, query),
    assignableTechnicians(context),
    businessTimezone(context),
  ]);

  const filtered = Object.entries(query).some(
    ([key, value]) => !["limit", "cursor"].includes(key) && value !== undefined,
  );
  const pageLink = (cursor?: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && key !== "cursor" && key !== "limit")
        params.set(key, String(value));
    }
    if (cursor) params.set("cursor", cursor);
    return `/jobs?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button asChild>
          <Link href="/jobs/new">New job</Link>
        </Button>
      </div>

      {/* key: reset the uncontrolled inputs when the URL changes (Clear, back button). */}
      <JobFilters key={JSON.stringify(raw)} query={query} technicians={technicians} />

      {items.length > 0 ? (
        <JobTable jobs={items} timezone={timezone} />
      ) : (
        <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {filtered ? "No jobs match these filters." : "No jobs yet. Create your first one."}
        </p>
      )}

      {(query.cursor || nextCursor) && (
        <div className="flex justify-end gap-2">
          {query.cursor && (
            <Button variant="outline" asChild>
              <Link href={pageLink()}>First page</Link>
            </Button>
          )}
          {nextCursor && (
            <Button variant="outline" asChild>
              <Link href={pageLink(nextCursor)}>Next page</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
