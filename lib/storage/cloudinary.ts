import { createHash } from "node:crypto";
import { logger } from "@/lib/http/logger";
import { UPLOAD_TTL_MS, type FileStorage, type StoredFile, type UploadParams } from "./storage";

function config() {
  const {
    CLOUDINARY_CLOUD_NAME: cloud,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: secret,
  } = process.env;
  if (!cloud || !apiKey || !secret) {
    throw new Error("STORAGE_DRIVER=cloudinary needs the CLOUDINARY_* environment variables");
  }
  return { cloud, apiKey, secret };
}

/** Cloudinary's signature: sorted key=value pairs joined by &, then the secret, SHA-1. */
function signParams(params: Record<string, string>, secret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(payload + secret)
    .digest("hex");
}

/**
 * Production driver. The browser uploads straight to Cloudinary with a signature that pins the
 * public ID and the allowed formats, so files never pass through a Vercel function.
 * Cloudinary has no size limit on a signed upload, so describe() checks the stored size and the
 * service deletes anything too large.
 */
export class CloudinaryStorage implements FileStorage {
  async createUploadParams({ key }: { key: string; maxBytes: number }) {
    const { cloud, apiKey, secret } = config();
    // Cloudinary accepts a signature for an hour after `timestamp`. Back-dating it by 50 minutes
    // leaves the 10-minute window that NFR-SEC-04 asks for.
    const timestamp = String(Math.floor((Date.now() - (60 * 60 * 1000 - UPLOAD_TTL_MS)) / 1000));
    const signed = { public_id: key, timestamp, allowed_formats: "jpg,jpeg,png,webp" };
    return {
      provider: "cloudinary",
      url: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      fields: { ...signed, api_key: apiKey, signature: signParams(signed, secret) },
      fileField: "file",
      key,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_MS).toISOString(),
    } satisfies UploadParams;
  }

  getUrl(key: string, opts: { width?: number } = {}): string {
    const transform = opts.width ? `c_limit,w_${opts.width},f_auto,q_auto/` : "f_auto,q_auto/";
    return `https://res.cloudinary.com/${config().cloud}/image/upload/${transform}${key}`;
  }

  async describe(key: string): Promise<StoredFile | null> {
    const { cloud, apiKey, secret } = config();
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${key}`,
      { headers: { authorization: `Basic ${btoa(`${apiKey}:${secret}`)}` }, cache: "no-store" },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloudinary lookup failed: ${response.status}`);
    const data = (await response.json()) as StoredFile;
    return { bytes: data.bytes, width: data.width, height: data.height, format: data.format };
  }

  async delete(key: string): Promise<void> {
    const { cloud, apiKey, secret } = config();
    const params = { public_id: key, timestamp: String(Math.floor(Date.now() / 1000)) };
    const body = new URLSearchParams({
      ...params,
      api_key: apiKey,
      signature: signParams(params, secret),
    });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
      method: "POST",
      body,
    });
    if (!response.ok) logger.error("cloudinary_delete_failed", { key, status: response.status });
  }

  async read(key: string, opts: { width?: number } = {}) {
    // Cloudinary converts on the fly, so ask for a JPEG react-pdf can draw.
    const width = opts.width ? `,w_${opts.width}` : "";
    const response = await fetch(
      `https://res.cloudinary.com/${config().cloud}/image/upload/c_limit${width},f_jpg,q_80/${key}`,
    );
    if (!response.ok) return null;
    return { data: Buffer.from(await response.arrayBuffer()), format: "jpg" as const };
  }

  async list() {
    const { cloud, apiKey, secret } = config();
    const files: { key: string; createdAt: Date }[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({ prefix: "fieldops/", max_results: "500" });
      if (cursor) params.set("next_cursor", cursor);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?${params}`,
        { headers: { authorization: `Basic ${btoa(`${apiKey}:${secret}`)}` }, cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Cloudinary list failed: ${response.status}`);
      const page = (await response.json()) as {
        resources: { public_id: string; created_at: string }[];
        next_cursor?: string;
      };
      for (const r of page.resources) {
        files.push({ key: r.public_id, createdAt: new Date(r.created_at) });
      }
      cursor = page.next_cursor;
    } while (cursor);
    return files;
  }
}
