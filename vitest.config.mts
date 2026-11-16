import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    // The first run downloads a mongod binary, so allow plenty of time.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    env: {
      JWT_SECRET: "test-only-secret-at-least-32-characters-long",
    },
    coverage: {
      provider: "v8",
      include: ["lib/services/**", "lib/domain/**"],
      thresholds: { lines: 70 },
    },
  },
});
