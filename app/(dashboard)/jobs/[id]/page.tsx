import { FileDownIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CancelJobDialog } from "@/components/jobs/cancel-job-dialog";
import { PhotoGallery } from "@/components/jobs/photo-gallery";
import { PriorityBadge, StatusBadge } from "@/components/jobs/status-badge";
import { StatusTimeline } from "@/components/jobs/status-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { isFinal } from "@/lib/domain/job-status";
import { formatInZone, formatWindow } from "@/lib/domain/time";
import { orNotFound, parseIdOr404 } from "@/lib/http/page";
import { getJob } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { context } = await requirePageRole(OFFICE_ROLES);
  const job = await orNotFound(getJob(context, parseIdOr404((await params).id)));
  const tz = job.timezone;
  const at = (iso: string | null) => (iso ? formatInZone(iso, tz, "d MMM yyyy, HH:mm") : "-");
  const final = isFinal(job.status);

  return (
    <div className="max-w-4xl space-y-4">
      <Button variant="link" asChild className="px-0">
        <Link href="/jobs">Back to jobs</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {job.number} · {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} overdue={job.overdue} />
            <PriorityBadge priority={job.priority} />
          </div>
        </div>
        {job.status === "completed" && (
          <Button asChild>
            <a href={`/api/jobs/${job.id}/report`} download>
              <FileDownIcon /> Download PDF
            </a>
          </Button>
        )}
        {!final && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/jobs/${job.id}/edit`}>Edit</Link>
            </Button>
            <CancelJobDialog jobId={job.id} number={job.number} />
          </div>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photos">Photos ({job.photos.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <Link href={`/customers/${job.customerId}`} className="font-medium underline">
                  {job.customerName}
                </Link>
              </p>
              <p>
                <a href={`tel:${job.customerPhone}`} className="underline">
                  {job.customerPhone}
                </a>
              </p>
              <p className="text-muted-foreground">
                {job.address.label}: {job.address.line1}, {job.address.city} {job.address.pincode}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{formatWindow(job.scheduledStart, job.scheduledEnd, tz)}</p>
              <p>Technician: {job.technicianName ?? "Unassigned"}</p>
              <p>Started: {at(job.startedAt)}</p>
              <p>Completed: {at(job.completedAt)}</p>
              {job.cancelReason && <p>Cancelled because: {job.cancelReason}</p>}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Description</p>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {job.description || "No description."}
                </p>
              </div>
              <div>
                <p className="font-medium">Technician notes</p>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {job.notes || "No notes yet."}
                </p>
              </div>
              <div>
                <p className="font-medium">Customer signature</p>
                {job.signature ? (
                  <figure className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={job.signature.url}
                      alt={`Signature of ${job.customerName}`}
                      className="h-24 rounded-md border bg-white p-1"
                    />
                    <figcaption className="text-muted-foreground text-xs">
                      Signed {at(job.signature.signedAt)}
                    </figcaption>
                  </figure>
                ) : (
                  <p className="text-muted-foreground">Not signed yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardContent className="pt-6">
              <PhotoGallery jobId={job.id} photos={job.photos} editable={!final} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <StatusTimeline history={job.statusHistory} timezone={tz} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
