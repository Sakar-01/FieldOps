import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getJwtSecret } from "@/lib/env";
import { KEY_PATTERN, UPLOAD_TTL_MS, type FileStorage, type UploadParams } from "./storage";

/** Development driver: files go to ./uploads through /api/uploads/local. */
const ROOT = path.join(process.cwd(), "uploads");

const sign = (key: string, expires: string, maxBytes: string) =>
  createHmac("sha256", getJwtSecret()).update(`${key}|${expires}|${maxBytes}`).digest("hex");

export function filePath(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
  return path.join(ROOT, ...key.split("/"));
}

export type ImageFormat = "jpeg" | "png" | "webp";

/** Reads the file's magic bytes, so a renamed file can't pass as an image. */
export function sniffImage(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Checks an upload signed by createUploadParams. Returns the size limit it was signed for. */
export function verifyLocalUpload(fields: {
  key: string;
  expires: string;
  maxBytes: string;
  signature: string;
}): number | null {
  const { key, expires, maxBytes, signature } = fields;
  if (!KEY_PATTERN.test(key) || Number(expires) < Date.now()) return null;
  const expected = Buffer.from(sign(key, expires, maxBytes), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Number(maxBytes);
}

export async function saveLocalFile(key: string, data: Uint8Array): Promise<void> {
  const target = filePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export const readLocalFile = (key: string) => readFile(filePath(key));

export class LocalDiskStorage implements FileStorage {
  async createUploadParams({ key, maxBytes }: { key: string; maxBytes: number }) {
    const expires = String(Date.now() + UPLOAD_TTL_MS);
    const max = String(maxBytes);
    return {
      provider: "local",
      url: "/api/uploads/local",
      fields: { key, expires, maxBytes: max, signature: sign(key, expires, max) },
      fileField: "file",
      key,
      expiresAt: new Date(Number(expires)).toISOString(),
    } satisfies UploadParams;
  }

  getUrl(key: string): string {
    return `/api/uploads/local/${key}`;
  }

  async describe(key: string) {
    try {
      const target = filePath(key);
      const [info, head] = [await stat(target), await readFile(target)];
      const format = sniffImage(head.subarray(0, 12));
      return format ? { bytes: info.size, format } : null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(filePath(key), { force: true });
  }

  async read(key: string) {
    try {
      const data = await readFile(filePath(key));
      const format = sniffImage(data);
      // react-pdf can't draw WebP; the browser upload keeps JPEG and PNG as they are.
      if (format === "jpeg") return { data, format: "jpg" as const };
      if (format === "png") return { data, format: "png" as const };
      return null;
    } catch {
      return null;
    }
  }

  async list() {
    const root = path.join(ROOT, "fieldops");
    const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
    const files = entries.filter((entry) => entry.isFile());
    return Promise.all(
      files.map(async (entry) => {
        const full = path.join(entry.parentPath, entry.name);
        const key = path.relative(ROOT, full).split(path.sep).join("/");
        return { key, createdAt: (await stat(full)).mtime };
      }),
    );
  }
}
