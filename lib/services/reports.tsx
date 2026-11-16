import { renderToBuffer } from "@react-pdf/renderer";
import type { ObjectId } from "mongodb";
import type { AuthContext } from "@/lib/auth/session";
import { businessesRepo } from "@/lib/db/repositories/businesses";
import { photosRepo } from "@/lib/db/repositories/photos";
import { jobsRepo } from "@/lib/db/repositories/jobs";
import { formatInZone } from "@/lib/domain/time";
import { preconditionFailed } from "@/lib/http/errors";
import { JobReport, type ReportImage } from "@/lib/pdf/job-report";
import { getStorage } from "@/lib/storage";
import { getJob } from "./jobs";

/** FR-PDF-01: rendered on demand for completed jobs; nothing is stored. */
export async function renderJobReport(ctx: AuthContext, id: ObjectId) {
  // getJob applies the same access rules as viewing the job (a technician: own jobs only).
  const job = await getJob(ctx, id);
  if (job.status !== "completed") {
    throw preconditionFailed("A report is available once the job is completed");
  }

  const [business, photoDocs, jobDoc] = await Promise.all([
    businessesRepo.findById(ctx.businessId),
    photosRepo.listForJob(ctx.businessId, id),
    jobsRepo.findById(ctx.businessId, id),
  ]);
  const storage = getStorage();

  // A photo that can't be read (deleted, or a WebP locally) is left out rather than failing.
  const photos = (
    await Promise.all(
      photoDocs.map(async (photo): Promise<ReportImage | null> => {
        const image = await storage.read(photo.key, { width: 800 }).catch(() => null);
        return image && { ...image, label: photo.kind === "before" ? "Before" : "After" };
      }),
    )
  ).filter((p): p is ReportImage => p !== null);

  const signatureImage = jobDoc?.signature
    ? await storage.read(jobDoc.signature.key, { width: 600 }).catch(() => null)
    : null;
  const signature = signatureImage && {
    ...signatureImage,
    label: `Signed ${formatInZone(jobDoc!.signature!.signedAt, job.timezone, "d MMM yyyy, HH:mm")}`,
  };

  const buffer = await renderToBuffer(
    <JobReport
      businessName={business?.name ?? "FieldOps"}
      job={job}
      photos={photos}
      signature={signature}
      appUrl={process.env.APP_URL ?? "http://localhost:3000"}
    />,
  );
  return { buffer, filename: `${job.number}-report.pdf` };
}
