import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { forbidden, notFound } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { isLocalStorage, KEY_PATTERN } from "@/lib/storage";
import { readLocalFile, sniffImage } from "@/lib/storage/local";

type Context = { params: Promise<{ key: string[] }> };

/** Serves ./uploads in development, only to users of the business that owns the file. */
export const GET = route<Context>(async (req, { params }) => {
  if (!isLocalStorage()) throw notFound();
  const ctx = await requireRole(req);
  const key = (await params).key.join("/");
  if (!KEY_PATTERN.test(key)) throw notFound("File");
  if (key.split("/")[1] !== ctx.businessId.toHexString()) throw forbidden();

  const data = await readLocalFile(key).catch(() => null);
  if (!data) throw notFound("File");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": `image/${sniffImage(data) ?? "jpeg"}`,
      "cache-control": "private, max-age=86400",
    },
  });
});
