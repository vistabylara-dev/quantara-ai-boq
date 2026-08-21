import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isFinitePrismaDecimal } from "../src/lib/validation/prisma-decimal";

describe("Prisma Decimal runtime compatibility", () => {
  it("uses Decimal#isFinite when the runtime provides it", () => {
    expect(isFinitePrismaDecimal(new Prisma.Decimal("12.34"))).toBe(true);
    expect(isFinitePrismaDecimal(new Prisma.Decimal(Number.NaN))).toBe(false);
  });

  it("supports Prisma's finite-only workerd Decimal shape", () => {
    const finiteOnlyDecimal = { toString: () => "12.34" } as Prisma.Decimal;
    const invalidFiniteOnlyDecimal = { toString: () => "Infinity" } as Prisma.Decimal;

    expect(isFinitePrismaDecimal(finiteOnlyDecimal)).toBe(true);
    expect(isFinitePrismaDecimal(invalidFiniteOnlyDecimal)).toBe(false);
  });
});
