"use client";

import imageCompression from "browser-image-compression";
import { api, ApiError } from "@/lib/http/client";
import type { UploadParams } from "@/lib/storage/storage";
import { MAX_UPLOAD_BYTES, type UploadKind } from "@/lib/validators/jobs";

export interface UploadedImage {
  key: string;
  width: number;
  height: number;
  bytes: number;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** UX rule: compress in the browser to at most 1600 px before uploading. */
async function compress(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Choose a JPEG, PNG or WebP photo");
  }
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 1.5,
    initialQuality: 0.8,
    // The worker would load the library from a CDN, which the CSP blocks.
    useWebWorker: false,
  });
}

async function dimensions(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** POSTs straight to storage. XHR rather than fetch, because fetch can't report upload progress. */
function send(params: UploadParams, blob: Blob, onProgress?: (percent: number) => void) {
  const form = new FormData();
  for (const [name, value] of Object.entries(params.fields)) form.set(name, value);
  form.set(params.fileField, blob, "upload");

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", params.url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "The upload failed. Please try again.";
      try {
        const body = JSON.parse(xhr.responseText);
        message = body?.error?.message ?? message;
      } catch {}
      reject(new ApiError(xhr.status, "UPLOAD_FAILED", message));
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Can't reach the server."));
    xhr.send(form);
  });
}

/** Signs, uploads and measures one image. The caller saves the metadata with the returned key. */
export async function uploadImage(
  jobId: string,
  kind: UploadKind,
  file: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  const blob = file instanceof File && kind !== "signature" ? await compress(file) : file;
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "VALIDATION_ERROR", "Images can be at most 5 MB");
  }
  const [params, size] = await Promise.all([
    api<UploadParams>("/api/uploads/sign", { body: { jobId, kind } }),
    dimensions(blob),
  ]);
  await send(params, blob, onProgress);
  return { key: params.key, bytes: blob.size, ...size };
}
