import { closeClient, getDb } from "@/lib/db/client";
import { createIndexes } from "@/lib/db/indexes";

async function main() {
  await createIndexes(await getDb());
  console.log("Indexes created");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeClient);
