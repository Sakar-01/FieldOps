import { describe, expect, it } from "vitest";
import { signupSchema } from "@/lib/validators/auth";
import { createCustomerSchema } from "@/lib/validators/customers";
import { addMemberSchema } from "@/lib/validators/team";

const address = { label: "Home", line1: "12 MG Road", city: "Indore", pincode: "452001" };

describe("signupSchema", () => {
  const valid = {
    businessName: "Acme",
    name: "Olivia",
    email: "OWNER@Example.com ",
    password: "12345678",
  };

  it("lowercases and trims the email", () => {
    expect(signupSchema.parse(valid).email).toBe("owner@example.com");
  });

  it("requires at least 8 characters in the password", () => {
    expect(signupSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
  });

  it("rejects passwords bcrypt would truncate", () => {
    expect(signupSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
  });
});

describe("createCustomerSchema (FR-CUST-02)", () => {
  const valid = { name: "Ramesh", phone: "98765 43210", addresses: [address] };

  it("normalises the phone number and fills in optional fields", () => {
    const parsed = createCustomerSchema.parse(valid);
    expect(parsed.phone).toBe("9876543210");
    expect(parsed.email).toBe("");
    expect(parsed.notes).toBe("");
  });

  it("needs at least one address", () => {
    expect(createCustomerSchema.safeParse({ ...valid, addresses: [] }).success).toBe(false);
  });

  it("allows 5 addresses but not 6", () => {
    const addresses = (n: number) => Array.from({ length: n }, () => address);
    expect(createCustomerSchema.safeParse({ ...valid, addresses: addresses(5) }).success).toBe(
      true,
    );
    expect(createCustomerSchema.safeParse({ ...valid, addresses: addresses(6) }).success).toBe(
      false,
    );
  });
});

describe("addMemberSchema", () => {
  it("does not allow creating a second owner", () => {
    const result = addMemberSchema.safeParse({
      name: "Sneaky",
      email: "s@example.com",
      phone: "9876543210",
      role: "owner",
      temporaryPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });
});
