"use client";

import { CameraIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { showApiError } from "@/components/shared/show-api-error";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PhotoKind } from "@/lib/db/types";
import { api } from "@/lib/http/client";
import type { PhotoDto } from "@/lib/services/jobs";
import { uploadImage } from "@/lib/uploads/client";
import { MAX_PHOTOS_PER_JOB } from "@/lib/validators/jobs";

const KIND_LABELS: Record<PhotoKind, string> = { before: "Before", after: "After" };

/** FR-FILE-01, FR-FILE-03: upload before/after photos and show them as thumbnails. */
export function PhotoGallery({
  jobId,
  photos,
  editable,
  large,
}: {
  jobId: string;
  photos: PhotoDto[];
  editable: boolean;
  /** Technician screens: bigger touch targets. */
  large?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const remaining = MAX_PHOTOS_PER_JOB - photos.length;

  async function upload(kind: PhotoKind, files: FileList | null) {
    const chosen = Array.from(files ?? []).slice(0, remaining);
    if (chosen.length === 0) return;
    try {
      for (const [index, file] of chosen.entries()) {
        setBusy(`Uploading ${index + 1} of ${chosen.length}...`);
        setProgress(0);
        const uploaded = await uploadImage(jobId, kind, file, setProgress);
        await api(`/api/jobs/${jobId}/photos`, { body: { kind, ...uploaded } });
      }
      toast.success(chosen.length === 1 ? "Photo added" : `${chosen.length} photos added`);
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  async function remove(photo: PhotoDto) {
    try {
      await api(`/api/jobs/${jobId}/photos/${photo.id}`, { method: "DELETE" });
      toast.success("Photo removed");
      router.refresh();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <div className="space-y-4">
      {editable && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(["before", "after"] as const).map((kind) => (
              <PhotoInput
                key={kind}
                label={`Add ${KIND_LABELS[kind].toLowerCase()} photo`}
                disabled={busy !== null || remaining <= 0}
                large={large}
                onFiles={(files) => upload(kind, files)}
              />
            ))}
          </div>
          {busy && (
            <div className="space-y-1" aria-live="polite">
              <p className="text-muted-foreground text-xs">{busy}</p>
              <Progress value={progress} aria-label="Upload progress" />
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            {remaining > 0
              ? `Up to ${remaining} more photo${remaining === 1 ? "" : "s"}.`
              : `This job has the maximum of ${MAX_PHOTOS_PER_JOB} photos.`}
          </p>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos yet.</p>
      ) : (
        (["before", "after"] as const).map((kind) => {
          const ofKind = photos.filter((p) => p.kind === kind);
          if (ofKind.length === 0) return null;
          return (
            <section key={kind} className="space-y-2">
              <h3 className="text-sm font-medium">{KIND_LABELS[kind]}</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {ofKind.map((photo) => (
                  <li key={photo.id} className="relative">
                    <a href={photo.url} target="_blank" rel="noreferrer">
                      {/* Thumbnails come pre-sized from storage, so next/image adds nothing. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbUrl}
                        alt={`${KIND_LABELS[kind]} photo`}
                        loading="lazy"
                        className="aspect-square w-full rounded-md border object-cover"
                      />
                    </a>
                    {editable && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute top-1 right-1 size-9"
                        aria-label={`Remove ${KIND_LABELS[kind].toLowerCase()} photo`}
                        onClick={() => remove(photo)}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function PhotoInput({
  label,
  disabled,
  large,
  onFiles,
}: {
  label: string;
  disabled: boolean;
  large?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        // Opens the rear camera on phones (UX rules); desktops get a file picker.
        capture="environment"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={large ? "lg" : "default"}
        className={large ? "min-h-11 flex-1" : undefined}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <CameraIcon /> {label}
      </Button>
    </>
  );
}
