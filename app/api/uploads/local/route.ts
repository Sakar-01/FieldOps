import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { AppError, forbidden, notFound } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { isLocalStorage } from "@/lib/storage";
import { saveLocalFile, sniffImage, verifyLocalUpload } from "@/lib/storage/local";

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const badRequest = (message: string) => new AppError(400, "VALIDATION_ERROR", message);

/**
 * Development stand-in for Cloudinary's upload endpoint. In production files go straight to
 * Cloudinary and never pass through the app, so this answers 404 there.
 */
export const POST = route(async (req) => {
  if (!isLocalStorage()) throw notFound();
  const ctx = await requireRole(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the file as multipart form data");
  }

  const key = field(form, "key");
  const maxBytes = verifyLocalUpload({
    key,
    expires: field(form, "expires"),
    maxBytes: field(form, "maxBytes"),
    signature: field(form, "signature"),
  });
  if (maxBytes === null) throw forbidden("This upload link is invalid or has expired");
  if (key.split("/")[1] !== ctx.businessId.toHexString()) throw forbidden();

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a file");
  if (file.size > maxBytes) throw badRequest("Images can be at most 5 MB");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffImage(bytes)) throw badRequest("Upload a JPEG, PNG or WebP image");
  await saveLocalFile(key, bytes);
  return NextResponse.json({ key, bytes: bytes.length }, { status: 201 });
});
