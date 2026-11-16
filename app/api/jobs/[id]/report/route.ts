import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { route, type IdContext } from "@/lib/http/route";
import { renderJobReport } from "@/lib/services/reports";
import { objectIdSchema } from "@/lib/validators/common";

export const GET = route<IdContext>(async (req, { params }) => {
  const ctx = await requireRole(req);
  const id = objectIdSchema.parse((await params).id);
  const { buffer, filename } = await renderJobReport(ctx, new ObjectId(id));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
