import { MongoClient, type ClientSession, type Db } from "mongodb";
import { getMongoUri } from "@/lib/env";

// NFR-PERF-01: one client per serverless instance, kept across hot reloads too.
const cache = globalThis as typeof globalThis & { __fieldopsMongo?: Promise<MongoClient> };

export function getClient(): Promise<MongoClient> {
  if (!cache.__fieldopsMongo) {
    // A small pool: Atlas free allows few connections and each Vercel instance has its own.
    const client = new MongoClient(getMongoUri(), { maxPoolSize: 10 });
    cache.__fieldopsMongo = client.connect().catch((error) => {
      cache.__fieldopsMongo = undefined; // let the next request retry
      throw error;
    });
  }
  return cache.__fieldopsMongo;
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db();
}

export async function closeClient(): Promise<void> {
  const pending = cache.__fieldopsMongo;
  cache.__fieldopsMongo = undefined;
  if (pending) await (await pending).close();
}

/**
 * Runs fn in a transaction. The driver retries the whole callback on a transient error such as
 * a write conflict, so fn must only do database work through `session` and be safe to repeat.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getClient();
  return client.withSession((session) => session.withTransaction(() => fn(session)));
}
