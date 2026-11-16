"use client";

import { tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Filtering and pagination happen on the server, so the core row model is all we need.
export const dataTableFeatures = tableFeatures({});
type Features = typeof dataTableFeatures;

interface DataTableProps<TData extends RowData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each column has its own value type
  columns: ColumnDef<Features, TData, any>[];
  data: TData[];
  getRowId: (row: TData) => string;
  caption: string;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  caption,
}: DataTableProps<TData>) {
  const table = useTable({ features: dataTableFeatures, columns, data, getRowId });

  return (
    <div className="rounded-lg border">
      <Table aria-label={caption}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
