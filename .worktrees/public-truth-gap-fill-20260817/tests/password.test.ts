import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

describe("password hashing", () => {
  it("hashes a password and verifies the correct plaintext", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(hash).not.toBe("CorrectHorse123");
    expect(await verifyPassword("CorrectHorse123", hash)).toBe(true);
  });

  it("rejects an incorrect password against an existing hash", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(await verifyPassword("WrongPassword1", hash)).toBe(false);
  });

  it("produces a different hash for the same password on each call (unique salt)", async () => {
    const [first, second] = await Promise.all([
      hashPassword("SamePassword1"),
      hashPassword("SamePassword1"),
    ]);
    expect(first).not.toBe(second);
  });
});
