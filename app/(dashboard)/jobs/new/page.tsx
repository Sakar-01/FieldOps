import { ObjectId } from "mongodb";
import type { Metadata } from "next";
import { JobForm } from "@/components/jobs/job-form";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { getCustomer } from "@/lib/services/customers";
import { assignableTechnicians, businessTimezone } from "@/lib/services/jobs";
import { objectIdSchema } from "@/lib/validators/common";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { context } = await requirePageRole(OFFICE_ROLES);
  // Arriving from a customer's page preselects them.
  const customerId = objectIdSchema.safeParse((await searchParams).customerId);
  const [technicians, timezone, customer] = await Promise.all([
    assignableTechnicians(context),
    businessTimezone(context),
    customerId.success
      ? getCustomer(context, new ObjectId(customerId.data)).catch(() => undefined)
      : undefined,
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New job</h1>
      <JobForm timezone={timezone} technicians={technicians} customer={customer} />
    </div>
  );
}
