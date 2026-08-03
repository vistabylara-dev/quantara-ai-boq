import type { DrawingPage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export function toDrawingPageDTO(page: DrawingPage) {
  return {
    id: page.id,
    projectFileId: page.projectFileId,
    pageNumber: page.pageNumber,
    sheetName: page.sheetName,
    width: page.width,
    height: page.height,
    dpi: page.dpi,
    hasImage: Boolean(page.imageStorageKey),
    detectedScale: page.detectedScale,
    scaleUnit: page.scaleUnit,
    scaleConfidence: page.scaleConfidence?.toNumber() ?? null,
    processingStatus: page.processingStatus,
    createdAt: page.createdAt.toISOString(),
  };
}

export async function listDrawingPages(companyId: string, projectFileId: string): Promise<DrawingPage[]> {
  return prisma.drawingPage.findMany({ where: { companyId, projectFileId }, orderBy: { pageNumber: "asc" } });
}

export async function getDrawingPageRecord(companyId: string, pageId: string): Promise<DrawingPage> {
  const row = await prisma.drawingPage.findFirst({ where: { id: pageId, companyId } });
  if (!row) throw new NotFoundError("Drawing page not found.");
  return row;
}

export type CreateDrawingPageInput = {
  projectFileId: string;
  pageNumber: number;
  width?: number;
  height?: number;
  dpi?: number;
  imageStorageKey?: string;
  processingStatus: string;
};

export async function replaceDrawingPagesForFile(companyId: string, projectFileId: string, pages: CreateDrawingPageInput[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.drawingPage.deleteMany({ where: { companyId, projectFileId } });
    for (const page of pages) {
      await tx.drawingPage.create({
        data: {
          companyId,
          projectFileId: page.projectFileId,
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          dpi: page.dpi,
          imageStorageKey: page.imageStorageKey,
          processingStatus: page.processingStatus,
        },
      });
    }
  });
}

export type DbClient = typeof prisma | Prisma.TransactionClient;
