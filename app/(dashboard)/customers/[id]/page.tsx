import { ObjectId } from "mongodb";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { AppError } from "@/lib/http/errors";
import { getCustomer } from "@/lib/services/customers";
import { businessTimezone, listJobs } from "@/lib/services/jobs";
import { StatusBadge } from "@/components/jobs/status-badge";
import { formatWindow } from "@/lib/domain/time";
import { objectIdSchema } from "@/lib/validators/common";

export const metadata: Metadata = { title: "Customer" };

async function loadCustomer(...[ctx, id]: Parameters<typeof getCustomer>) {
  try {
    return await getCustomer(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { context } = await requirePageRole(OFFICE_ROLES);
  const id = objectIdSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const customer = await loadCustomer(context, new ObjectId(id.data));
  const [jobs, timezone] = await Promise.all([
    listJobs(context, { customerId: customer.id, limit: 10 }),
    businessTimezone(context),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <Button variant="link" asChild className="px-0">
        <Link href="/customers">Back to customers</Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/jobs/new?customerId=${customer.id}`}>New job</Link>
          </Button>
          <CustomerFormDialog customer={customer} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Phone:{" "}
            <a href={`tel:${customer.phone}`} className="underline">
              {customer.phone}
            </a>
          </p>
          <p>Email: {customer.email || "-"}</p>
          {customer.notes && <p className="whitespace-pre-wrap">Notes: {customer.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {customer.addresses.map((address) => (
              <li key={address.id}>
                <p className="font-medium">{address.label}</p>
                <p className="text-muted-foreground">
                  {address.line1}, {address.city} {address.pincode}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs for this customer yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {jobs.items.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="font-medium underline">
                      {job.number}
                    </Link>{" "}
                    · {job.title}
                    <p className="text-muted-foreground text-xs">
                      {formatWindow(job.scheduledStart, job.scheduledEnd, timezone)}
                    </p>
                  </div>
                  <StatusBadge status={job.status} overdue={job.overdue} />
                </li>
              ))}
            </ul>
          )}
          {jobs.nextCursor && (
            <Button variant="link" asChild className="px-0">
              <Link href={`/jobs?q=${encodeURIComponent(customer.name)}`}>All jobs</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
