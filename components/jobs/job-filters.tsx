"use client";

import Form from "next/form";
import Link from "next/link";
import { useId } from "react";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES } from "@/lib/db/types";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/domain/job-status";
import type { ListJobsQuery } from "@/lib/validators/jobs";
import { PRIORITY_LABELS } from "./status-badge";
import type { TechnicianOption } from "./job-form";

// Radix Select can't hold an empty value, so "any" stands for "no filter"; the query schema
// reads it as unset.
const ANY = "any";

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue ?? ANY}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** FR-JOB-07. A plain GET form, so filters live in the URL and survive reloads and sharing. */
export function JobFilters({
  query,
  technicians,
}: {
  query: ListJobsQuery;
  technicians: TechnicianOption[];
}) {
  const ids = { q: useId(), from: useId(), to: useId() };

  return (
    <Form
      action="/jobs"
      role="search"
      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={ids.q}>Search</Label>
        <Input
          id={ids.q}
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="Job number (FO-0012) or customer name"
        />
      </div>
      <FilterSelect
        name="status"
        label="Status"
        defaultValue={query.status}
        options={JOB_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <FilterSelect
        name="priority"
        label="Priority"
        defaultValue={query.priority}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
      />
      <FilterSelect
        name="technicianId"
        label="Technician"
        defaultValue={query.technicianId}
        options={[
          { value: "none", label: "Unassigned" },
          ...technicians.map((t) => ({ value: t.id, label: t.name })),
        ]}
      />
      <div className="space-y-1">
        <Label htmlFor={ids.from}>From</Label>
        <DatePicker id={ids.from} name="from" defaultValue={query.from} placeholder="Any date" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={ids.to}>To</Label>
        <DatePicker id={ids.to} name="to" defaultValue={query.to} placeholder="Any date" />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">Apply</Button>
        <Button variant="ghost" asChild>
          <Link href="/jobs">Clear</Link>
        </Button>
      </div>
    </Form>
  );
}
