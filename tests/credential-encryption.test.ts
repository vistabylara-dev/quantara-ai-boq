import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptCredential, encryptCredential } from "../src/lib/integrations/credential-encryption";

describe("integration credential encryption configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the encryption key is missing", () => {
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", "");
    expect(() => encryptCredential("secret")).toThrow(/is not set/i);
  });

  it("rejects a key that does not decode to exactly 32 bytes", () => {
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(31, 7).toString("base64"));
    expect(() => encryptCredential("secret")).toThrow(/exactly 32 bytes/i);
  });

  it("round-trips credentials only with a valid 32-byte key", () => {
    vi.stubEnv("INTEGRATION_CREDENTIALS_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const encrypted = encryptCredential("private-token");
    expect(encrypted).not.toContain("private-token");
    expect(decryptCredential(encrypted)).toBe("private-token");
  });
});
