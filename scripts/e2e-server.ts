import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Playwright's web server: a throwaway replica set seeded with the demo business, then the built
 * app (`next start`) pointed at it. Needs `npm run build` first. Nothing touches your own database.
 */
async function main() {
  const port = process.env.E2E_PORT ?? "3100";
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("fieldops_e2e");
  process.env.STORAGE_DRIVER = "local";
  process.env.JWT_SECRET ??= "e2e-only-secret-at-least-32-characters-long";

  // Imported after MONGODB_URI is set, since the client reads it on first use.
  const { createIndexes } = await import("@/lib/db/indexes");
  const { getDb, closeClient } = await import("@/lib/db/client");
  const { resetDemo } = await import("@/lib/services/demo");
  await createIndexes(await getDb());
  await resetDemo();
  await closeClient();

  const app = spawn("npx", ["next", "start", "-p", port], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "production" },
  });
  const stop = async () => {
    app.kill();
    await replSet.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", async (code) => {
    await replSet.stop();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
