import { describe, expect, it } from "vitest";
import { normalizePostgresSslMode } from "@/lib/db/postgres-connection-string";

describe("Postgres connection-string SSL normalization", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "makes the legacy %s mode explicitly verify the server identity",
    (sslmode) => {
      const input = `postgresql://user:secret@example-pooler.test:5432/quantara_staging?sslmode=${sslmode}&channel_binding=require&schema=public`;
      const normalized = new URL(normalizePostgresSslMode(input));

      expect(normalized.searchParams.get("sslmode")).toBe("verify-full");
      expect(normalized.hostname).toBe("example-pooler.test");
      expect(normalized.pathname).toBe("/quantara_staging");
      expect(normalized.searchParams.get("channel_binding")).toBe("require");
      expect(normalized.searchParams.get("schema")).toBe("public");
    },
  );

  it.each(["disable", "allow", "verify-full"])("preserves an intentional %s mode", (sslmode) => {
    const input = `postgresql://user:secret@localhost:5432/test?sslmode=${sslmode}`;
    expect(normalizePostgresSslMode(input)).toBe(input);
  });

  it("preserves local URLs without sslmode and malformed non-URL values", () => {
    const local = "postgresql://user:secret@localhost:5432/test?schema=public";
    expect(normalizePostgresSslMode(local)).toBe(local);
    expect(normalizePostgresSslMode("not-a-url")).toBe("not-a-url");
  });
});
