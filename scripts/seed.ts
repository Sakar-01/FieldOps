import { closeClient, getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";
import { DEMO_EMAILS } from "@/lib/demo/generate";
import { resetDemo } from "@/lib/services/demo";

/** npm run seed: (re)creates the demo business. Safe to run again; it replaces the old one. */
async function main() {
  await createIndexes(await getDb());
  const counts = await resetDemo();
  console.log(
    `Demo business seeded: ${counts.users} users, ${counts.customers} customers, ${counts.jobs} jobs.`,
  );
  console.log(
    `Use "Try as Owner" (${DEMO_EMAILS.owner}) or "Try as Technician" on the login page.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
