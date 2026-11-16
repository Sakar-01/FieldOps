"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TextField } from "@/components/shared/text-field";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, errorMessage } from "@/lib/http/client";
import { addMemberSchema } from "@/lib/validators/team";

type FormInput = z.input<typeof addMemberSchema>;
type FormOutput = z.output<typeof addMemberSchema>;

const EMPTY: FormInput = {
  name: "",
  email: "",
  phone: "",
  role: "technician",
  temporaryPassword: "",
};

export function AddMemberDialog() {
  const router = useRouter();
  const roleId = useId();
  const [open, setOpen] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: EMPTY,
  });

  async function onSubmit(values: FormOutput) {
    try {
      await api("/api/team", { body: values });
      toast.success(`${values.name} added. Share their temporary password with them.`);
      form.reset(EMPTY);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>They can log in straight away with these details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextField control={form.control} name="name" label="Name" />
            <TextField control={form.control} name="email" label="Email" type="email" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={roleId}>Role</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={roleId}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <TextField
              control={form.control}
              name="temporaryPassword"
              label="Temporary password"
              type="text"
              autoComplete="off"
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add member"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
