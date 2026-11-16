import { describe, expect, it } from "vitest";
import { checkProductionConfig } from "@/lib/env";
import { memoryLimit } from "@/lib/http/rate-limit";

const complete = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb+srv://user:pass@cluster0.example.mongodb.net/fieldops",
  JWT_SECRET: "x".repeat(32),
  STORAGE_DRIVER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  CRON_SECRET: "cron",
  APP_URL: "https://fieldops.example.com",
} as const;

describe("checkProductionConfig", () => {
  it("accepts a complete configuration", () => {
    expect(checkProductionConfig({ ...complete })).toEqual({ errors: [], warnings: [] });
  });

  it("refuses to start without the database, a strong secret or Cloudinary keys", () => {
    const { errors } = checkProductionConfig({
      ...complete,
      MONGODB_URI: "",
      JWT_SECRET: "short",
      CLOUDINARY_API_SECRET: "",
    });
    expect(errors).toHaveLength(3);
  });

  it("only warns about optional services such as Upstash", () => {
    const { errors, warnings } = checkProductionConfig({
      ...complete,
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining("Upstash")]);
  });

  it("warns that local storage doesn't survive a redeploy", () => {
    const { warnings } = checkProductionConfig({ ...complete, STORAGE_DRIVER: "local" });
    expect(warnings).toEqual([expect.stringContaining("STORAGE_DRIVER")]);
  });
});

describe("in-memory rate limit (production without Upstash)", () => {
  it("allows 5 logins a minute per key, then resets after the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(memoryLimit("login", "ip:a@x", now)).toBe(true);
    expect(memoryLimit("login", "ip:a@x", now)).toBe(false);
    expect(memoryLimit("login", "ip:b@x", now)).toBe(true);
    expect(memoryLimit("login", "ip:a@x", now + 60_000)).toBe(true);
  });
});
