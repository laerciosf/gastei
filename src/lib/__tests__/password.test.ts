import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password utilities", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("my-secret-password");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("my-secret-password");
  });

  it("should verify a correct password", async () => {
    const hash = await hashPassword("my-secret-password");
    const isValid = await verifyPassword("my-secret-password", hash);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hash = await hashPassword("my-secret-password");
    const isValid = await verifyPassword("wrong-password", hash);
    expect(isValid).toBe(false);
  });
});
