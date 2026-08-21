import { describe, expect, it } from "vitest";
import { generateRawToken, hashToken } from "../src/lib/auth/tokens";

describe("token generation and hashing", () => {
  it("generates high-entropy, unique raw tokens", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically so a stored hash can be matched by lookup", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken(generateRawToken())).not.toBe(hashToken(generateRawToken()));
  });
});
