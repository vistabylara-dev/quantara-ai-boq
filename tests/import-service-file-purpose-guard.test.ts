import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createImportJob } from "../src/lib/services/import-service";
import { AppError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

/**
 * Regression coverage for the production incident where a PDF drawing was
 * misrouted through /imports and returned "This XLSX file couldn't be read"
 * — a spreadsheet-specific error for a file that was never a spreadsheet.
 * createImportJob's sourceType is entirely client-supplied (derived from the
 * filename in the browser); these tests prove the server itself checks the
 * real byte signature before ever handing the buffer to the XLSX/CSV
 * parser, regardless of what the client claims.
 */
const RUN_ID = `${Date.now()}-${process.pid}`;
let companyId: string;
let userId: string;

function actor(): CurrentActor {
  return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "Test Actor", email: "actor@example.com" };
}

function pdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
}

beforeAll(async () => {
  const company = await prisma.company.create({
    data: {
      legalName: `Import Guard Test Co ${RUN_ID}`,
      tradeName: "Import Guard",
      email: `import-guard-${RUN_ID}@example.com`,
    },
  });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      companyId,
      email: `import-guard-owner-${RUN_ID}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Test Actor",
      role: UserRole.COMPANY_OWNER,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.importRow.deleteMany({ where: { companyId } });
  await prisma.importJob.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
});

describe("import-service — file-purpose guard (integration, real local Postgres)", () => {
  it("rejects a PDF declared as XLSX with a purpose-specific error, never the XLSX-couldn't-be-read message", async () => {
    await expect(
      createImportJob(actor(), {
        uploadedFileName: "drawing.pdf",
        buffer: pdfBuffer(),
        sourceType: "XLSX",
        destinationType: "COMPANY_LIBRARY",
      }),
    ).rejects.toMatchObject({ code: "IMPORT_FILE_NOT_SPREADSHEET" });
  });

  it("never returns the spreadsheet parse-failure message for a PDF", async () => {
    try {
      await createImportJob(actor(), {
        uploadedFileName: "drawing.pdf",
        buffer: pdfBuffer(),
        sourceType: "XLSX",
        destinationType: "COMPANY_LIBRARY",
      });
      throw new Error("expected createImportJob to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const message = (error as AppError).message;
      expect(message).not.toContain("XLSX file couldn't be read");
      expect(message.toLowerCase()).toContain("pdf");
    }
  });

  it("rejects a PDF declared as CSV too (signature check runs before the sourceType branch)", async () => {
    await expect(
      createImportJob(actor(), {
        uploadedFileName: "drawing.pdf",
        buffer: pdfBuffer(),
        sourceType: "CSV",
        destinationType: "COMPANY_LIBRARY",
      }),
    ).rejects.toMatchObject({ code: "IMPORT_FILE_NOT_SPREADSHEET" });
  });

  it("rejects a non-ZIP buffer declared as XLSX with a spreadsheet-specific (not PDF) message", async () => {
    await expect(
      createImportJob(actor(), {
        uploadedFileName: "not-really.xlsx",
        buffer: Buffer.from("just some plain text, not a real xlsx file"),
        sourceType: "XLSX",
        destinationType: "COMPANY_LIBRARY",
      }),
    ).rejects.toMatchObject({ code: "IMPORT_FILE_NOT_SPREADSHEET" });
  });

  it("still accepts a real CSV file", async () => {
    const csv = "Code,Name,Unit,Cost\nA-1,Item,nos,10";
    const job = await createImportJob(actor(), {
      uploadedFileName: "real.csv",
      buffer: Buffer.from(csv, "utf-8"),
      sourceType: "CSV",
      destinationType: "COMPANY_LIBRARY",
    });
    expect(job.totalRows).toBe(1);
  });
});
