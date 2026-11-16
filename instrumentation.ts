import { checkProductionConfig, isProduction } from "@/lib/env";

/** Runs once when a server instance starts: refuse to start with a broken production config. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !isProduction()) return;

  const { errors, warnings } = checkProductionConfig(process.env);
  for (const message of warnings) {
    console.warn(JSON.stringify({ level: "warn", msg: "config_warning", detail: message }));
  }
  if (errors.length > 0) {
    throw new Error(
      `FieldOps can't start. Fix these environment variables:\n- ${errors.join("\n- ")}`,
    );
  }
}
