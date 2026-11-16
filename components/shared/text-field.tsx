"use client";

import { useId, type ComponentProps } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface TextFieldProps<TValues extends FieldValues, TOutput> extends Omit<
  ComponentProps<"input">,
  "name" | "form"
> {
  // TOutput lets schemas that transform their input (phone, email) keep their typing.
  control: Control<TValues, unknown, TOutput>;
  name: FieldPath<TValues>;
  label: string;
}

export function TextField<TValues extends FieldValues, TOutput>({
  control,
  name,
  label,
  ...inputProps
}: TextFieldProps<TValues, TOutput>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input {...inputProps} {...field} id={id} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

interface TextAreaFieldProps<TValues extends FieldValues, TOutput> {
  control: Control<TValues, unknown, TOutput>;
  name: FieldPath<TValues>;
  label: string;
}

export function TextAreaField<TValues extends FieldValues, TOutput>({
  control,
  name,
  label,
}: TextAreaFieldProps<TValues, TOutput>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Textarea {...field} id={id} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
