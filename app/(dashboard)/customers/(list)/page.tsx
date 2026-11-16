import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerTable } from "@/components/customers/customer-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePageRole } from "@/lib/auth/current-user";
import { OFFICE_ROLES } from "@/lib/auth/require-role";
import { listCustomers } from "@/lib/services/customers";
import { listCustomersQuerySchema } from "@/lib/validators/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { context } = await requirePageRole(OFFICE_ROLES);

  // A hand-edited URL shouldn't produce an error page: fall back to the first page.
  const parsed = listCustomersQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listCustomersQuerySchema.parse({});
  const { items, nextCursor } = await listCustomers(context, query);

  const nextParams = new URLSearchParams();
  if (query.q) nextParams.set("q", query.q);
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <CustomerFormDialog />
      </div>

      <Form action="/customers" className="flex max-w-md gap-2" role="search">
        <Input
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="Search by name or phone"
          aria-label="Search customers by name or phone"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </Form>

      {items.length > 0 ? (
        <CustomerTable customers={items} />
      ) : (
        <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          {query.q ? `No customers match "${query.q}".` : "No customers yet. Add your first one."}
        </p>
      )}

      {(query.cursor || nextCursor) && (
        <div className="flex justify-end gap-2">
          {query.cursor && (
            <Button variant="outline" asChild>
              <Link href={query.q ? `/customers?q=${encodeURIComponent(query.q)}` : "/customers"}>
                First page
              </Link>
            </Button>
          )}
          {nextCursor && (
            <Button variant="outline" asChild>
              <Link href={`/customers?${nextParams}`}>Next page</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
