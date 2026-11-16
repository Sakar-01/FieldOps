"use client";

import "swagger-ui-dist/swagger-ui.css";
import { useEffect, useRef } from "react";

/**
 * Swagger UI from npm rather than a CDN: the CSP only allows scripts from this origin.
 * Loaded on demand so its ~1 MB stays off every other page.
 */
export function SwaggerUi() {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("swagger-ui-dist/swagger-ui-es-bundle.js").then(({ default: SwaggerUIBundle }) => {
      if (!cancelled && node.current) {
        SwaggerUIBundle({ url: "/api/openapi", domNode: node.current, deepLinking: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Swagger UI only has a light theme, so it keeps a white panel in dark mode too.
  return <div ref={node} className="min-h-svh rounded-lg bg-white text-black" />;
}
