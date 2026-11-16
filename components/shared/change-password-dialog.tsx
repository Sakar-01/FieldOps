"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { FieldGroup } from "@/components/ui/field";
import { api, ApiError, errorMessage } from "@/lib/http/client";
import { changePasswordSchema } from "@/lib/validators/auth";

type Input = z.input<typeof changePasswordSchema>;
type Output = z.output<typeof changePasswordSchema>;
const EMPTY = { currentPassword: "", newPassword: "" };

/** Replaces the temporary password an owner hands out (FR-TEAM-01). */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  async function onSubmit(values: Output) {
    try {
      await api("/api/me/password", { body: values });
      toast.success("Password changed");
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        form.setError("currentPassword", { message: error.message });
        return;
      }
      toast.error(errorMessage(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(EMPTY);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change password">
          <KeyRoundIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>At least 8 characters.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
            />
            <TextField
              control={form.control}
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Change password"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
