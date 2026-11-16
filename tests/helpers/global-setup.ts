import { MongoMemoryReplSet } from "mongodb-memory-server";

// A replica set rather than a standalone server: the double-booking guard uses
// transactions, which standalone MongoDB doesn't support.
export default async function setup() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("fieldops_test");
  return async () => {
    await replSet.stop();
  };
}
