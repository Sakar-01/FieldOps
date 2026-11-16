import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// A stand-in for Upstash with the same sliding-window contract, so the real limiter code path
// (configuration, keys, error mapping) runs without a Redis server.
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private hits = new Map<string, number[]>();
    constructor(private options: { limiter: { count: number; ms: number } }) {}
    static slidingWindow(count: number, window: string) {
      return { count, ms: Number.parseInt(window) * 60_000 };
    }
    async limit(key: string) {
      const now = Date.now();
      const { count, ms } = this.options.limiter;
      const recent = (this.hits.get(key) ?? []).filter((t) => now - t < ms);
      recent.push(now);
      this.hits.set(key, recent);
      return { success: recent.length <= count };
    }
  }
  return { Ratelimit };
});

describe("rate limiting", () => {
  beforeAll(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  });
  afterAll(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns 429 on the 6th login attempt in a minute", async () => {
    const { POST: login } = await import("@/app/api/auth/login/route");
    const { request } = await import("../helpers/api");
    const attempt = () =>
      login(
        request("/api/auth/login", {
          method: "POST",
          body: { email: "nobody@example.com", password: "wrong-password" },
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
        undefined,
      );

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    expect((await (await attempt()).json()).error.code).toBe("RATE_LIMITED");
  });

  it("counts each IP and email separately", async () => {
    const { enforceRateLimit } = await import("@/lib/http/rate-limit");
    for (let i = 0; i < 5; i++) await enforceRateLimit("login", "198.51.100.1:a@example.com");
    await expect(enforceRateLimit("login", "198.51.100.1:a@example.com")).rejects.toMatchObject({
      status: 429,
    });
    await expect(enforceRateLimit("login", "198.51.100.1:b@example.com")).resolves.toBeUndefined();
  });
});
