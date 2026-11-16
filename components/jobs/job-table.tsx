"use client";

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, dataTableFeatures } from "@/components/shared/data-table";
import { formatWindow } from "@/lib/domain/time";
import type { JobDto } from "@/lib/services/jobs";
import { PriorityBadge, StatusBadge } from "./status-badge";

const helper = createColumnHelper<typeof dataTableFeatures, JobDto>();

const columnsFor = (timezone: string) => [
  helper.accessor("number", {
    header: "Job",
    cell: ({ row }) => (
      <Link href={`/jobs/${row.original.id}`} className="font-medium whitespace-nowrap underline">
        {row.original.number}
      </Link>
    ),
  }),
  helper.accessor("customerName", { header: "Customer" }),
  helper.accessor("title", {
    header: "Title",
    cell: ({ getValue }) => <span className="line-clamp-1 max-w-56">{getValue()}</span>,
  }),
  helper.accessor("technicianName", {
    header: "Technician",
    cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">-</span>,
  }),
  helper.display({
    id: "when",
    header: "Scheduled",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatWindow(row.original.scheduledStart, row.original.scheduledEnd, timezone)}
      </span>
    ),
  }),
  helper.accessor("priority", {
    header: "Priority",
    cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
  }),
  helper.accessor("status", {
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} overdue={row.original.overdue} />,
  }),
];

export function JobTable({ jobs, timezone }: { jobs: JobDto[]; timezone: string }) {
  return (
    <DataTable
      columns={columnsFor(timezone)}
      data={jobs}
      getRowId={(job) => job.id}
      caption="Jobs"
    />
  );
}
