import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

process.env.DATABASE_URL = "postgresql://quantara:quantara_local_password@localhost:5432/quantara_e2e_boq?schema=public";

const prisma = new PrismaClient();

try {
  const companyId = randomUUID();
  const company = await prisma.company.create({
    data: {
      id: companyId,
      legalName: "Repro Test Company",
      tradeName: "Repro Test Company",
      email: "repro-test@example.com",
    },
  });
  console.log("created company:", company.id);
  await prisma.company.delete({ where: { id: companyId } });
  console.log("cleaned up");
} catch (err) {
  console.error("ERROR:", err);
} finally {
  await prisma.$disconnect();
}
