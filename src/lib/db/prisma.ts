import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  quantaraPrisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.quantaraPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.quantaraPrisma = prisma;
}

export default prisma;
