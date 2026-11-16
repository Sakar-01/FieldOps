/** Read lazily so `next build` and unit tests don't need every variable set. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function getMongoUri(): string {
  return required("MONGODB_URI");
}

export function getJwtSecret(): Uint8Array {
  const secret = required("JWT_SECRET");
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export const isProduction = () => process.env.NODE_ENV === "production";

export type ConfigReport = { errors: string[]; warnings: string[] };

/**
 * What a production deployment is missing. Errors stop the server from starting; warnings are
 * logged. Pure (takes the environment) so it can be unit tested.
 */
export function checkProductionConfig(env: NodeJS.ProcessEnv): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.MONGODB_URI) errors.push("MONGODB_URI is not set");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET must be set to at least 32 characters");
  }

  if (env.STORAGE_DRIVER === "cloudinary") {
    for (const name of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
      if (!env[name]) errors.push(`${name} is not set (STORAGE_DRIVER=cloudinary)`);
    }
  } else {
    warnings.push(
      "STORAGE_DRIVER is not cloudinary: uploads go to the server's disk, which Vercel and " +
        "Render free instances wipe on every deploy or restart",
    );
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push(
      "Upstash is not configured: rate limits are kept in this server's memory only, so they " +
        "reset on restart and are not shared between instances",
    );
  }
  if (!env.CRON_SECRET) warnings.push("CRON_SECRET is not set: the daily demo reset is disabled");
  if (!env.APP_URL) warnings.push("APP_URL is not set: PDF reports link to http://localhost:3000");

  return { errors, warnings };
}
