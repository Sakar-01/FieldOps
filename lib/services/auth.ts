import bcrypt from "bcryptjs";
import { MongoServerError } from "mongodb";
import { signToken } from "@/lib/auth/jwt";
import { businessesRepo } from "@/lib/db/repositories/businesses";
import { usersRepo } from "@/lib/db/repositories/users";
import type { BusinessDoc, UserDoc } from "@/lib/db/types";
import { AppError, emailTaken, forbidden, notFound } from "@/lib/http/errors";
import type { AuthContext } from "@/lib/auth/session";
import type { ChangePasswordInput, LoginInput, SignupInput } from "@/lib/validators/auth";

const BCRYPT_COST = 10;
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const isDuplicateKey = (error: unknown) =>
  error instanceof MongoServerError && error.code === 11000;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserDoc["role"];
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toUserDto(user: UserDoc): UserDto {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export interface BusinessDto {
  id: string;
  name: string;
  timezone: string;
  isDemo: boolean;
}

export function toBusinessDto(business: BusinessDoc): BusinessDto {
  return {
    id: business._id.toHexString(),
    name: business.name,
    timezone: business.timezone,
    isDemo: business.isDemo,
  };
}

const tokenFor = (user: UserDoc) =>
  signToken({
    userId: user._id.toHexString(),
    businessId: user.businessId.toHexString(),
    role: user.role,
  });

/** FR-AUTH-01 */
export async function signup(input: SignupInput) {
  // Hash first: it is the slow step, and nothing has been written if it fails.
  const passwordHash = await hashPassword(input.password);
  const business = await businessesRepo.insert({
    name: input.businessName,
    timezone: DEFAULT_TIMEZONE,
  });

  try {
    const user = await usersRepo.insert({
      businessId: business._id,
      name: input.name,
      email: input.email,
      phone: "",
      passwordHash,
      role: "owner",
    });
    return {
      user: toUserDto(user),
      business: toBusinessDto(business),
      token: await tokenFor(user),
    };
  } catch (error) {
    // Don't leave a business with no owner behind. The unique index is the real check
    // here, so two simultaneous signups with one email can't both succeed.
    await businessesRepo.remove(business._id);
    if (isDuplicateKey(error)) throw emailTaken();
    throw error;
  }
}

// Compared against when the email is unknown, so a miss takes as long as a wrong password
// and response time doesn't reveal which emails have accounts.
const dummyHash = bcrypt.hash("fieldops-timing-equalizer", BCRYPT_COST);

/** FR-AUTH-02, FR-TEAM-02 */
export async function login(input: LoginInput) {
  const user = await usersRepo.findByEmailForLogin(input.email);
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? (await dummyHash),
  );

  // One message for every failure, so it can't be used to discover accounts.
  if (!user || !passwordMatches || !user.active) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }

  await usersRepo.touchLastLogin(user.businessId, user._id);
  return { user: toUserDto(user), token: await tokenFor(user) };
}

/** Lets someone replace the temporary password the owner gave them (FR-TEAM-01). */
export async function changePassword(ctx: AuthContext, input: ChangePasswordInput) {
  const [user, business] = await Promise.all([
    usersRepo.findById(ctx.businessId, ctx.userId),
    businessesRepo.findById(ctx.businessId),
  ]);
  if (!user || !business) throw notFound("User");
  if (business.isDemo) throw forbidden("Demo accounts can't change their password");
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, "VALIDATION_ERROR", "Your current password is incorrect", {
      issues: [{ path: ["currentPassword"], message: "Your current password is incorrect" }],
    });
  }
  await usersRepo.setPassword(ctx.businessId, ctx.userId, await hashPassword(input.newPassword));
}
