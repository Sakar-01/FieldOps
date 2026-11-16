"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, dataTableFeatures } from "@/components/shared/data-table";
import type { CustomerDto } from "@/lib/services/customers";

const helper = createColumnHelper<typeof dataTableFeatures, CustomerDto>();

const columns = [
  helper.accessor("name", {
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/customers/${row.original.id}`} className="font-medium underline">
        {row.original.name}
      </Link>
    ),
  }),
  helper.accessor("phone", { header: "Phone" }),
  helper.accessor("email", { header: "Email", cell: ({ getValue }) => getValue() || "-" }),
  helper.display({
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.addresses[0]?.city ?? "-",
  }),
];

export function CustomerTable({ customers }: { customers: CustomerDto[] }) {
  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowId={(customer) => customer.id}
      caption="Customers"
    />
  );
}
