import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://localhost:${port}`;

/** One smoke test against the built app (`npm run build` first). See scripts/e2e-server.ts. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // The server starts cold, so each page's first render loads its code; 5 s (the default) is too
  // tight for the dashboard on a slow machine or CI runner.
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Locally use the installed Chrome, so no browser download is needed.
    channel: process.env.CI ? undefined : "chrome",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: `${baseURL}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { E2E_PORT: port },
  },
});
