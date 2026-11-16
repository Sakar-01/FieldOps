import { NextResponse } from "next/server";
import { route } from "@/lib/http/route";
import { openApiDocument } from "@/lib/openapi/registry";

export const GET = route(async () => NextResponse.json(openApiDocument()));
