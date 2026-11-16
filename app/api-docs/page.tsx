import type { Metadata } from "next";
import Link from "next/link";
import { SwaggerUi } from "@/components/docs/swagger-ui";

export const metadata: Metadata = { title: "API docs" };

/** FR-DOCS-01: generated from the same Zod schemas the handlers validate with. */
export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">FieldOps API</h1>
        <Link href="/api/openapi" className="text-sm underline">
          OpenAPI JSON
        </Link>
      </div>
      <p className="text-muted-foreground text-sm">
        Log in to the app in this browser first; &quot;Try it out&quot; then sends your session
        cookie.
      </p>
      <SwaggerUi />
    </main>
  );
}
