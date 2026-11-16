import { randomBytes } from "node:crypto";
import { signToken } from "@/lib/auth/jwt";
import { usersRepo } from "@/lib/db/repositories/users";
import { systemRepo } from "@/lib/db/repositories/system";
import { DEMO_EMAILS, generateDemoData } from "@/lib/demo/generate";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/http/logger";
import { getStorage } from "@/lib/storage";
import { hashPassword, toUserDto } from "./auth";

/** Files uploaded but never saved against a job are removed after a day. */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * FR-DEMO-01, FR-DEMO-02: replaces the demo business with fresh seed data. The demo accounts get
 * an unguessable password, so the "Try as" buttons are the only way in.
 */
export async function resetDemo(now = new Date()) {
  const storage = getStorage();
  for (const business of await systemRepo.findDemoBusinesses()) {
    const keys = await systemRepo.fileKeysOf(business._id);
    await Promise.all(keys.map((key) => storage.delete(key).catch(() => undefined)));
    await systemRepo.deleteBusiness(business._id);
  }
  const data = generateDemoData(await hashPassword(randomBytes(24).toString("hex")), now);
  await systemRepo.insertDemo(data);
  return {
    customers: data.customers.length,
    jobs: data.jobs.length,
    users: data.users.length,
  };
}

/** Removes stored files that no photo or signature points at and that are older than a day. */
export async function cleanupOrphanUploads(now = new Date()) {
  const storage = getStorage();
  const [files, referenced] = await Promise.all([storage.list(), systemRepo.allReferencedKeys()]);
  const orphans = files.filter(
    (f) => !referenced.has(f.key) && now.getTime() - f.createdAt.getTime() > ORPHAN_AGE_MS,
  );
  for (const file of orphans) {
    await storage
      .delete(file.key)
      .catch((error) =>
        logger.error("orphan_delete_failed", { key: file.key, error: String(error) }),
      );
  }
  return { checked: files.length, deleted: orphans.length };
}

/** FR-AUTH-06 */
export async function demoLogin(role: "owner" | "technician") {
  const user = await usersRepo.findByEmailForLogin(DEMO_EMAILS[role]);
  if (!user || !user.active) {
    throw new AppError(
      503,
      "INTERNAL",
      "The demo isn't available right now. Run `npm run seed`, or try again in a minute.",
    );
  }
  await usersRepo.touchLastLogin(user.businessId, user._id);
  const token = await signToken({
    userId: user._id.toHexString(),
    businessId: user.businessId.toHexString(),
    role: user.role,
  });
  return { user: toUserDto(user), token };
}

/** Seeded demo accounts: kept as they are so the next visitor finds the demo working. */
export const isSeededDemoEmail = (email: string) =>
  (Object.values(DEMO_EMAILS) as string[]).includes(email) || /@demo\.example\.com$/.test(email);
