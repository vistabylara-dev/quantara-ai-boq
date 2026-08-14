import type { Prisma } from "@prisma/client";

type WorkerdCompatibleDecimal = Prisma.Decimal & {
  isFinite?: () => boolean;
};

/**
 * Prisma's Node runtime exposes Decimal#isFinite, while its workerd runtime
 * uses a finite-only Decimal implementation without that method. The workerd
 * constructor rejects NaN and infinities, and the string fallback preserves
 * the same validation contract for any compatible Decimal implementation.
 */
export function isFinitePrismaDecimal(value: Prisma.Decimal): boolean {
  const compatible = value as WorkerdCompatibleDecimal;
  if (typeof compatible.isFinite === "function") {
    return compatible.isFinite();
  }

  return !/^[+-]?(?:Infinity|NaN)$/.test(value.toString());
}
