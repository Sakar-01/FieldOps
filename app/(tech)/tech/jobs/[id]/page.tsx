import { ArrowLeftIcon, FileDownIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PhotoGallery } from "@/components/jobs/photo-gallery";
import { StatusBadge } from "@/components/jobs/status-badge";
import { mapsLink } from "@/components/tech/maps-link";
import { SignaturePad } from "@/components/tech/signature-pad";
import { NotesEditor, StatusButtons } from "@/components/tech/tech-job-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/current-user";
import { isFinal } from "@/lib/domain/job-status";
import { formatWindow } from "@/lib/domain/time";
import { AppError } from "@/lib/http/errors";
import { orNotFound, parseIdOr404 } from "@/lib/http/page";
import { getJob } from "@/lib/services/jobs";

export const metadata: Metadata = { title: "Job" };

async function loadOwnJob(...args: Parameters<typeof getJob>) {
  try {
    return await orNotFound(getJob(...args));
  } catch (error) {
    // Someone else's job: the API answers 403; the page says so instead of a blank error.
    if (error instanceof AppError && error.status === 403) return null;
    throw error;
  }
}

export default async function TechJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { context } = await requirePageRole(["technician"]);
  const job = await loadOwnJob(context, parseIdOr404((await params).id));

  if (!job) {
    return (
      <div className="mx-auto max-w-lg space-y-3 text-center">
        <h1 className="text-xl font-semibold">Not your job</h1>
        <p className="text-muted-foreground text-sm">This job is assigned to someone else.</p>
        <Button asChild size="lg" className="min-h-11">
          <Link href="/tech/today">Back to today</Link>
        </Button>
      </div>
    );
  }

  const active = job.status === "in_progress";
  const hasAfterPhoto = job.photos.some((p) => p.kind === "after");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Button variant="ghost" asChild className="min-h-11 px-0">
        <Link href="/tech/today">
          <ArrowLeftIcon /> Today
        </Link>
      </Button>

      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{job.number}</p>
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <StatusBadge status={job.status} overdue={job.overdue} />
      </div>

      <Card className="gap-3 py-4">
        <CardContent className="space-y-2 px-4 text-sm">
          <p className="font-medium">
            {formatWindow(job.scheduledStart, job.scheduledEnd, job.timezone)}
          </p>
          <p>{job.customerName}</p>
          <p className="text-muted-foreground">
            {job.address.line1}, {job.address.city} {job.address.pincode}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="min-h-11 flex-1">
              <a href={mapsLink(job.address)} target="_blank" rel="noreferrer">
                <MapPinIcon /> Maps
              </a>
            </Button>
            <Button variant="outline" asChild className="min-h-11 flex-1">
              <a href={`tel:${job.customerPhone}`}>
                <PhoneIcon /> Call
              </a>
            </Button>
          </div>
          {job.description && (
            <p className="text-muted-foreground border-t pt-2 whitespace-pre-wrap">
              {job.description}
            </p>
          )}
        </CardContent>
      </Card>

      {job.status === "completed" && (
        <Button asChild size="lg" className="h-14 w-full text-base">
          <a href={`/api/jobs/${job.id}/report`} download>
            <FileDownIcon /> Download PDF report
          </a>
        </Button>
      )}

      <StatusButtons
        jobId={job.id}
        status={job.status}
        hasAfterPhoto={hasAfterPhoto}
        hasSignature={job.signature !== null}
      />

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <PhotoGallery jobId={job.id} photos={job.photos} editable={!isFinal(job.status)} large />
        </CardContent>
      </Card>

      {active ? (
        <Card className="gap-3 py-4">
          <CardContent className="space-y-4 px-4">
            <NotesEditor key={job.notes} jobId={job.id} initialNotes={job.notes} />
            {job.signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.signature.url}
                alt="Customer signature"
                className="h-20 rounded-md border bg-white p-1"
              />
            )}
            <SignaturePad jobId={job.id} signed={job.signature !== null} />
          </CardContent>
        </Card>
      ) : (
        job.notes && (
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Work notes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-sm whitespace-pre-wrap">{job.notes}</CardContent>
          </Card>
        )
      )}
    </div>
  );
}
