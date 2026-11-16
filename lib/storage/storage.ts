/** What the browser needs to upload one file straight to storage (multipart POST). */
export interface UploadParams {
  provider: "local" | "cloudinary";
  url: string;
  /** Form fields to send alongside the file. */
  fields: Record<string, string>;
  /** Name of the form field that carries the file. */
  fileField: string;
  /** Where the file will live; the browser sends it back when saving metadata. */
  key: string;
  expiresAt: string;
}

/** Facts read back from storage, so the server never trusts the browser's description. */
export interface StoredFile {
  bytes: number;
  width?: number;
  height?: number;
  format: string;
}

/**
 * Section 11. Swapping Cloudinary for S3 means adding one class that implements this.
 * The server chooses `key`, so a signed upload can only land in the job's own folder.
 */
export interface FileStorage {
  createUploadParams(input: { key: string; maxBytes: number }): Promise<UploadParams>;
  getUrl(key: string, opts?: { width?: number }): string;
  /** null when nothing was uploaded under this key. */
  describe(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
  /** The image bytes, for the PDF report. JPEG or PNG, at most `width` wide where supported. */
  read(
    key: string,
    opts?: { width?: number },
  ): Promise<{ data: Buffer; format: "jpg" | "png" } | null>;
  /** Every stored file under fieldops/, for the daily orphan cleanup. */
  list(): Promise<{ key: string; createdAt: Date }[]>;
}

/** NFR-SEC-04 */
export const UPLOAD_TTL_MS = 10 * 60 * 1000;

/** Keys look like fieldops/<businessId>/<jobId>/<kind>-<random>. Nothing else is accepted. */
export const KEY_PATTERN =
  /^fieldops\/[a-f0-9]{24}\/[a-f0-9]{24}\/(before|after|signature)-[a-f0-9]{16}$/;

export const jobFolder = (businessId: string, jobId: string) => `fieldops/${businessId}/${jobId}`;
