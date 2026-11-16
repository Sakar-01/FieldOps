import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "@/lib/auth/jwt";

const claims = {
  userId: "507f1f77bcf86cd799439011",
  businessId: "507f1f77bcf86cd799439012",
  role: "owner" as const,
};
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

describe("JWT", () => {
  it("round-trips its claims", async () => {
    expect(await verifyToken(await signToken(claims))).toEqual(claims);
  });

  it("rejects missing and garbage tokens", async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken("not-a-token")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signToken(claims);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: claims.userId, bid: claims.businessId, role: "owner", exp: 9e9 }),
    ).toString("base64url");
    expect(await verifyToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await new SignJWT({ bid: claims.businessId, role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("another-secret-that-is-also-32-characters"));
    expect(await verifyToken(token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({ bid: claims.businessId, role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret());
    expect(await verifyToken(token)).toBeNull();
  });

  it("rejects an unknown role", async () => {
    const token = await new SignJWT({ bid: claims.businessId, role: "superadmin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setExpirationTime("1h")
      .sign(secret());
    expect(await verifyToken(token)).toBeNull();
  });
});
