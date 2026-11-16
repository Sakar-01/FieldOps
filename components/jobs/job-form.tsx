"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Controller, useForm, type Control, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DatePicker } from "@/components/shared/date-picker";
import { showApiError } from "@/components/shared/show-api-error";
import { TextAreaField, TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES } from "@/lib/db/types";
import { dayKey, formatInZone, formatWindow, zonedToIso } from "@/lib/domain/time";
import { api, ApiError } from "@/lib/http/client";
import type { CustomerDto } from "@/lib/services/customers";
import type { JobDto } from "@/lib/services/jobs";
import { PRIORITY_LABELS } from "./status-badge";

const NO_TECHNICIAN = "none";
const time = z.string().regex(/^\d{2}:\d{2}$/, "Enter a time");

// The form works in the business timezone with a date and two times; it is converted to the
// API's UTC instants on submit. A job ends on the day it starts (the 12-hour cap makes that
// the normal case).
const formSchema = z
  .object({
    customerId: z.string().min(1, "Pick a customer"),
    addressId: z.string().min(1, "Pick an address"),
    title: z.string().trim().min(3, "Title is too short").max(120),
    description: z.string().trim().max(2000),
    priority: z.enum(PRIORITIES),
    date: z.string().min(1, "Pick a date"),
    startTime: time,
    endTime: time,
    technicianId: z.string(),
  })
  .refine((v) => v.endTime > v.startTime, {
    path: ["endTime"],
    message: "The end time must be after the start time",
  });
type FormValues = z.infer<typeof formSchema>;

export interface TechnicianOption {
  id: string;
  name: string;
}

interface JobFormProps {
  timezone: string;
  technicians: TechnicianOption[];
  /** Editing: the job and its customer. Creating: an optional preselected customer. */
  job?: JobDto;
  customer?: CustomerDto;
}

/** Maps API field paths onto this form's fields, so server errors appear in place. */
const FIELD_FOR: Record<string, FieldPath<FormValues>> = {
  customerId: "customerId",
  addressId: "addressId",
  title: "title",
  description: "description",
  priority: "priority",
  scheduledStart: "startTime",
  scheduledEnd: "endTime",
  technicianId: "technicianId",
};

interface Overlap {
  message: string;
  jobId: string;
}

export function JobForm({ timezone, technicians, job, customer: initialCustomer }: JobFormProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDto | undefined>(initialCustomer);
  const [overlap, setOverlap] = useState<Overlap | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: job
      ? {
          customerId: job.customerId,
          addressId: job.address.id,
          title: job.title,
          description: job.description,
          priority: job.priority,
          date: dayKey(job.scheduledStart, timezone),
          startTime: formatInZone(job.scheduledStart, timezone, "HH:mm"),
          endTime: formatInZone(job.scheduledEnd, timezone, "HH:mm"),
          technicianId: job.technicianId ?? NO_TECHNICIAN,
        }
      : {
          customerId: initialCustomer?.id ?? "",
          addressId: initialCustomer?.addresses[0]?.id ?? "",
          title: "",
          description: "",
          priority: "normal",
          date: dayKey(new Date(), timezone),
          startTime: "10:00",
          endTime: "11:00",
          technicianId: NO_TECHNICIAN,
        },
  });

  // A job created before the customer's addresses changed may point at an address that no
  // longer exists; keep it selectable so the job can be saved unchanged.
  const addresses = customer?.addresses ?? [];
  const addressOptions =
    job && !addresses.some((a) => a.id === job.address.id)
      ? [job.address, ...addresses]
      : addresses;
  const technicianOptions =
    job?.technicianId && !technicians.some((t) => t.id === job.technicianId)
      ? [{ id: job.technicianId, name: `${job.technicianName} (inactive)` }, ...technicians]
      : technicians;

  async function onSubmit(values: FormValues) {
    setOverlap(null);
    const body = {
      addressId: values.addressId,
      title: values.title,
      description: values.description,
      priority: values.priority,
      scheduledStart: zonedToIso(values.date, values.startTime, timezone),
      scheduledEnd: zonedToIso(values.date, values.endTime, timezone),
      technicianId: values.technicianId === NO_TECHNICIAN ? null : values.technicianId,
    };
    try {
      const saved = job
        ? await api<JobDto>(`/api/jobs/${job.id}`, {
            method: "PATCH",
            body: { ...body, version: job.version },
          })
        : await api<JobDto>("/api/jobs", { body: { ...body, customerId: values.customerId } });
      toast.success(job ? `${saved.number} updated` : `${saved.number} created`);
      router.push(`/jobs/${saved.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "JOB_OVERLAP") {
        const details = error.details as { conflictingJobId: string };
        setOverlap({ message: error.message, jobId: details.conflictingJobId });
        form.setError("technicianId", { message: "This technician is busy then" });
        return;
      }
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const issues = (error.details as { issues?: { path: string[]; message: string }[] })
          ?.issues;
        const field = issues?.[0] && FIELD_FOR[issues[0].path[0]];
        if (field) {
          form.setError(field, { message: issues![0].message });
          return;
        }
      }
      showApiError(error, router.push);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-2xl">
      <FieldGroup>
        {job ? (
          <Field>
            <FieldLabel>Customer</FieldLabel>
            <p className="text-sm">
              <Link href={`/customers/${job.customerId}`} className="underline">
                {job.customerName}
              </Link>
            </p>
          </Field>
        ) : (
          <Controller
            control={form.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <CustomerPicker
                selected={customer}
                invalid={fieldState.invalid}
                error={fieldState.error?.message}
                onSelect={(picked) => {
                  setCustomer(picked);
                  field.onChange(picked.id);
                  form.setValue("addressId", picked.addresses[0]?.id ?? "", {
                    shouldValidate: form.formState.isSubmitted,
                  });
                }}
              />
            )}
          />
        )}

        <SelectField
          control={form.control}
          name="addressId"
          label="Address"
          placeholder={customer || job ? "Pick an address" : "Pick a customer first"}
          disabled={addressOptions.length === 0}
          options={addressOptions.map((a) => ({
            value: a.id,
            label: `${a.label}: ${a.line1}, ${a.city}`,
          }))}
        />

        <TextField control={form.control} name="title" label="Title" />
        <TextAreaField control={form.control} name="description" label="Description (optional)" />

        <SelectField
          control={form.control}
          name="priority"
          label="Priority"
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={form.control}
            name="date"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="job-date">Date</FieldLabel>
                <DatePicker
                  id="job-date"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <TimeField control={form.control} name="startTime" label="Start" />
          <TimeField control={form.control} name="endTime" label="End" />
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">Times are in {timezone}.</p>

        <SelectField
          control={form.control}
          name="technicianId"
          label="Technician"
          options={[
            { value: NO_TECHNICIAN, label: "Unassigned" },
            ...technicianOptions.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />

        {overlap && (
          <div
            role="alert"
            className="border-destructive/50 text-destructive rounded-lg border p-3 text-sm"
          >
            {overlap.message}.{" "}
            <Link href={`/jobs/${overlap.jobId}`} className="font-medium underline">
              View that job
            </Link>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : job ? "Save changes" : "Create job"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
        {job && (
          <p className="text-muted-foreground text-xs">
            Currently {formatWindow(job.scheduledStart, job.scheduledEnd, timezone)}
          </p>
        )}
      </FieldGroup>
    </form>
  );
}

function TimeField({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: "startTime" | "endTime";
  label: string;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input {...field} id={id} type="time" step={900} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  placeholder,
  disabled,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger id={id} className="w-full" aria-invalid={fieldState.invalid}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Combobox that searches customers on the server as you type. */
function CustomerPicker({
  selected,
  onSelect,
  invalid,
  error,
}: {
  selected?: CustomerDto;
  onSelect: (customer: CustomerDto) => void;
  invalid: boolean;
  error?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "10",
          ...(query.trim() && { q: query.trim() }),
        });
        const response = await fetch(`/api/customers?${params}`, { signal: controller.signal });
        if (response.ok) setResults((await response.json()).items);
      } catch {
        // Aborted by the next keystroke, or offline; the list just stays as it was.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>Customer</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            className="w-full justify-between font-normal"
          >
            {selected ? `${selected.name} · ${selected.phone}` : "Search customers"}
            <ChevronsUpDownIcon className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          {/* Results are already filtered by the server. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Name (whole word) or phone"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{loading ? "Searching..." : "No customers found."}</CommandEmpty>
              <CommandGroup>
                {results.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => {
                      onSelect(customer);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{customer.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{customer.phone}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
