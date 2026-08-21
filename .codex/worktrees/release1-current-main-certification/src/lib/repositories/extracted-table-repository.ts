import { ExtractedTableType, Prisma, ExtractedTableStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ParsedTable } from "@/lib/files/table-extraction/types";

type DbClient = typeof prisma | Prisma.TransactionClient;

const tableInclude = {
  rows: {
    include: { cells: true },
    orderBy: { rowNumber: "asc" as const },
  },
} satisfies Prisma.ExtractedTableInclude;

export type ExtractedTableRecord = Prisma.ExtractedTableGetPayload<{ include: typeof tableInclude }>;

export function toExtractedTableDTO(table: ExtractedTableRecord) {
  return {
    id: table.id,
    companyId: table.companyId,
    projectFileId: table.projectFileId,
    sheetName: table.sheetName,
    title: table.title,
    tableType: table.tableType,
    confidence: table.confidence.toNumber(),
    sourceReference: table.sourceReference,
    status: table.status,
    rows: table.rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      parentRowId: row.parentRowId,
      confidence: row.confidence.toNumber(),
      status: row.status,
      cells: row.cells.map((cell) => ({
        id: cell.id,
        columnKey: cell.columnKey,
        rawValue: cell.rawValue,
        normalizedValue: cell.normalizedValue,
        confidence: cell.confidence.toNumber(),
        sourceCellReference: cell.sourceCellReference,
      })),
    })),
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}

export async function listExtractedTablesForFile(companyId: string, projectFileId: string, db: DbClient = prisma): Promise<ExtractedTableRecord[]> {
  return db.extractedTable.findMany({
    where: { companyId, projectFileId },
    include: tableInclude,
    orderBy: { createdAt: "asc" },
  });
}

/** True if any row from a previous extraction pass has already been reviewed — re-extraction must not silently discard that work. */
export async function hasReviewedRows(companyId: string, projectFileId: string, db: DbClient = prisma): Promise<boolean> {
  const count = await db.extractedTableRow.count({
    where: {
      companyId,
      extractedTable: { projectFileId },
      status: { not: ExtractedTableStatus.EXTRACTED },
    },
  });
  return count > 0;
}

/**
 * Replaces all extracted tables for a file with a fresh parse result.
 * Callers must check hasReviewedRows() first — this function itself does
 * not guard against discarding confirmed/corrected rows, so it is only
 * safe to call when nothing has been reviewed yet.
 */
export async function replaceExtractedTablesForFile(
  companyId: string,
  projectFileId: string,
  parsedTables: ParsedTable[],
  tableType: ExtractedTableType,
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.extractedTable.deleteMany({ where: { companyId, projectFileId } });

    const createdTableIds: string[] = [];
    for (const parsed of parsedTables) {
      const table = await tx.extractedTable.create({
        data: {
          companyId,
          projectFileId,
          sheetName: parsed.sheetName,
          title: parsed.title,
          tableType,
          confidence: parsed.confidence,
          status: ExtractedTableStatus.EXTRACTED,
        },
      });
      createdTableIds.push(table.id);

      const rowIdByRowNumber = new Map<number, string>();
      // Parents are always emitted before their children by the parsers, but sort defensively so parentRowId is always resolvable.
      const orderedRows = [...parsed.rows].sort((a, b) => (a.parentRowNumber ? 1 : 0) - (b.parentRowNumber ? 1 : 0));

      for (const row of orderedRows) {
        const parentRowId = row.parentRowNumber !== undefined ? rowIdByRowNumber.get(row.parentRowNumber) ?? null : null;
        const rawDataJson = Object.fromEntries(row.cells.map((cell) => [cell.columnKey, cell.rawValue]));

        const createdRow = await tx.extractedTableRow.create({
          data: {
            companyId,
            extractedTableId: table.id,
            rowNumber: row.rowNumber,
            parentRowId,
            rawDataJson: rawDataJson as Prisma.InputJsonValue,
            confidence: row.confidence,
            status: ExtractedTableStatus.EXTRACTED,
          },
        });
        // Only top-level rows register themselves as a lookup target for children. A row
        // number can be reused by a same-numbered child (the XLSX parser's merge-group parent
        // and its first physical row share a rowNumber) — never let that child's creation
        // overwrite the true parent's id in this map.
        if (row.parentRowNumber === undefined) {
          rowIdByRowNumber.set(row.rowNumber, createdRow.id);
        }

        for (const cell of row.cells) {
          await tx.extractedTableCell.create({
            data: {
              companyId,
              extractedTableRowId: createdRow.id,
              columnKey: cell.columnKey,
              rawValue: cell.rawValue,
              confidence: row.confidence,
              sourceCellReference: cell.sourceCellReference,
            },
          });
        }
      }
    }

    return createdTableIds;
  });
}
