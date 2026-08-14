import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  adapterConfigs: [] as Array<Record<string, unknown>>,
  clientOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPgMock {
    constructor(config: Record<string, unknown>) {
      state.adapterConfigs.push(config);
    }
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class PrismaClientMock {
    constructor(options: Record<string, unknown>) {
      state.clientOptions.push(options);
    }

    $queryRaw() {
      return undefined;
    }
  },
}));

vi.mock("../src/lib/cloudflare/env", () => ({
  getHyperdriveBinding: () => ({ connectionString: "postgresql://hyperdrive.invalid/quantara" }),
  isCloudflareRuntime: () => true,
}));

describe("Prisma factory: Cloudflare request lifecycle", () => {
  it("creates a one-use Hyperdrive adapter for each top-level Prisma operation", async () => {
    const { prisma, getPrismaConnectionMethod } = await import("../src/lib/db/prisma");

    const firstOperation = prisma.$queryRaw;
    const secondOperation = prisma.$queryRaw;

    expect(firstOperation).not.toBe(secondOperation);
    expect(state.clientOptions).toHaveLength(2);
    expect(state.adapterConfigs).toEqual([
      expect.objectContaining({ max: 1, maxUses: 1 }),
      expect.objectContaining({ max: 1, maxUses: 1 }),
    ]);
    expect(getPrismaConnectionMethod()).toBe("hyperdrive");
  });
});
