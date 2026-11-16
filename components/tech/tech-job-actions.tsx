"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { showApiError } from "@/components/shared/show-api-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/http/client";
import type { JobStatus } from "@/lib/domain/job-status";
import { MAX_NOTES } from "@/lib/validators/jobs";

/** FR-TECH-02: large Start and Complete buttons; Complete shows what is still missing. */
export function StatusButtons({
  jobId,
  status,
  hasAfterPhoto,
  hasSignature,
}: {
  jobId: string;
  status: JobStatus;
  hasAfterPhoto: boolean;
  hasSignature: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function move(to: "in_progress" | "completed") {
    setSaving(true);
    try {
      await api(`/api/jobs/${jobId}/status`, { body: { to } });
      toast.success(to === "in_progress" ? "Job started" : "Job completed. Nice work!");
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  if (status === "scheduled") {
    return (
      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={saving}
        onClick={() => move("in_progress")}
      >
        {saving ? "Starting..." : "Start job"}
      </Button>
    );
  }

  if (status !== "in_progress") return null;
  const ready = hasAfterPhoto && hasSignature;
  const checklist = [
    { done: hasAfterPhoto, label: "At least one after photo" },
    { done: hasSignature, label: "Customer signature" },
  ];

  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm" aria-label="Needed to complete">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.done ? (
              <CheckCircle2Icon className="size-4 text-green-600" aria-hidden />
            ) : (
              <CircleIcon className="text-muted-foreground size-4" aria-hidden />
            )}
            {item.label}
            <span className="sr-only">{item.done ? "(done)" : "(missing)"}</span>
          </li>
        ))}
      </ul>
      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={!ready || saving}
        onClick={() => move("completed")}
      >
        {saving ? "Completing..." : "Complete job"}
      </Button>
    </div>
  );
}

/** FR-TECH-03 */
export function NotesEditor({ jobId, initialNotes }: { jobId: string; initialNotes: string }) {
  const router = useRouter();
  const id = useId();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const dirty = notes !== initialNotes;

  async function save() {
    setSaving(true);
    try {
      await api(`/api/jobs/${jobId}/notes`, { method: "PATCH", body: { notes } });
      toast.success("Notes saved");
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Work notes</Label>
      <Textarea
        id={id}
        value={notes}
        maxLength={MAX_NOTES}
        rows={5}
        placeholder="What did you find and fix?"
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {notes.length}/{MAX_NOTES}
        </span>
        <Button size="lg" className="min-h-11" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving..." : "Save notes"}
        </Button>
      </div>
    </div>
  );
}
