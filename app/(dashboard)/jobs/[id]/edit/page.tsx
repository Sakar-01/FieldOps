import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JobForm } from "@/components/jobs/job-form";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { isFinal } from "@/lib/domain/job-status";
import { getCustomer } from "@/lib/services/customers";
import { assignableTechnicians, getJob } from "@/lib/services/jobs";
import { orNotFound, parseIdOr404 } from "@/lib/http/page";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { context } = await requirePageRole(OFFICE_ROLES);
  const id = parseIdOr404((await params).id);
  const job = await orNotFound(getJob(context, id));
  if (isFinal(job.status)) redirect(`/jobs/${job.id}`);

  const [technicians, customer] = await Promise.all([
    assignableTechnicians(context),
    getCustomer(context, parseIdOr404(job.customerId)).catch(() => undefined),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit {job.number}</h1>
      <JobForm timezone={job.timezone} technicians={technicians} job={job} customer={customer} />
    </div>
  );
}
