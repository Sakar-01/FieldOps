"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { showApiError } from "@/components/shared/show-api-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http/client";

/** FR-JOB-08: destructive, so it uses AlertDialog and needs a reason. */
export function CancelJobDialog({ jobId, number }: { jobId: string; number: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const missing = reason.trim().length === 0;

  async function cancelJob() {
    setTouched(true);
    if (missing) return;
    setSaving(true);
    try {
      await api(`/api/jobs/${jobId}/status`, { body: { to: "cancelled", reason } });
      toast.success(`${number} cancelled`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setReason("");
          setTouched(false);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Cancel job</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {number}?</AlertDialogTitle>
          <AlertDialogDescription>
            A cancelled job can&apos;t be reopened. The technician&apos;s time is freed up.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={id}>Reason</Label>
          <Textarea
            id={id}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={touched && missing}
            aria-describedby={touched && missing ? `${id}-error` : undefined}
          />
          {touched && missing && (
            <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
              Give a reason for cancelling
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep job</AlertDialogCancel>
          {/* A plain button, so the dialog stays open while the request runs or fails. */}
          <Button variant="destructive" onClick={cancelJob} disabled={saving}>
            {saving ? "Cancelling..." : "Cancel job"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
