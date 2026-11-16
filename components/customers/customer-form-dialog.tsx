"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TextAreaField, TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/http/client";
import type { CustomerDto } from "@/lib/services/customers";
import { createCustomerSchema } from "@/lib/validators/customers";

type FormInput = z.input<typeof createCustomerSchema>;
type FormOutput = z.output<typeof createCustomerSchema>;

const MAX_ADDRESSES = 5;
const BLANK_ADDRESS = { label: "", line1: "", city: "", pincode: "" };

const valuesFor = (customer?: CustomerDto): FormInput =>
  customer
    ? {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
        addresses: customer.addresses,
      }
    : { name: "", phone: "", email: "", notes: "", addresses: [BLANK_ADDRESS] };

export function CustomerFormDialog({ customer }: { customer?: CustomerDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: valuesFor(customer),
  });
  // keyName: addresses have their own `id`, which useFieldArray would otherwise overwrite.
  const addresses = useFieldArray({ control: form.control, name: "addresses", keyName: "key" });

  async function onSubmit(values: FormOutput) {
    try {
      if (customer) {
        await api(`/api/customers/${customer.id}`, { method: "PATCH", body: values });
        toast.success("Customer updated");
      } else {
        await api("/api/customers", { body: values });
        toast.success("Customer added");
        form.reset(valuesFor());
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function onOpenChange(next: boolean) {
    // Reopening shows the saved values, not whatever was abandoned last time.
    if (next) form.reset(valuesFor(customer));
    setOpen(next);
  }

  const addressError = form.formState.errors.addresses;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={customer ? "outline" : "default"}>
          {customer ? "Edit" : "Add customer"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "Add a customer"}</DialogTitle>
          <DialogDescription>A customer needs at least one address.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <TextField control={form.control} name="email" label="Email (optional)" type="email" />
            <TextAreaField control={form.control} name="notes" label="Notes (optional)" />

            {addresses.fields.map((address, index) => (
              <fieldset key={address.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium">Address {index + 1}</legend>
                  {addresses.fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove address ${index + 1}`}
                      onClick={() => addresses.remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                <TextField control={form.control} name={`addresses.${index}.label`} label="Label" />
                <TextField
                  control={form.control}
                  name={`addresses.${index}.line1`}
                  label="Address"
                />
                <TextField control={form.control} name={`addresses.${index}.city`} label="City" />
                <TextField
                  control={form.control}
                  name={`addresses.${index}.pincode`}
                  label="Pincode"
                />
              </fieldset>
            ))}

            {addressError?.root && <FieldError errors={[addressError.root]} />}

            {addresses.fields.length < MAX_ADDRESSES && (
              <Button
                type="button"
                variant="outline"
                onClick={() => addresses.append(BLANK_ADDRESS)}
              >
                <PlusIcon /> Add another address
              </Button>
            )}

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
