import { randomUUID } from "node:crypto";
import { ExtractedTableType, Prisma, ExtractedTableStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ParsedTable } from "@/lib/files/table-extraction/types";

type DbClient = typeof prisma | Prisma.TransactionClient;

function readHeaderTitles(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const headerTitles = (value as Record<string, unknown>).headerTitles;
  if (!headerTitles || typeof headerTitles !== "object" || Array.isArray(headerTitles)) return {};
  return Object.fromEntries(
    Object.entries(headerTitles as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

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
    rows: table.rows.map((row) => {
      const headerTitles = readHeaderTitles(row.normalizedDataJson);
      return {
        id: row.id,
        rowNumber: row.rowNumber,
        parentRowId: row.parentRowId,
        confidence: row.confidence.toNumber(),
        status: row.status,
        cells: row.cells.map((cell) => ({
          id: cell.id,
          columnKey: cell.columnKey,
          columnTitle: headerTitles[cell.columnKey] ?? cell.columnKey,
          rawValue: cell.rawValue,
          normalizedValue: cell.normalizedValue,
          confidence: cell.confidence.toNumber(),
          sourceCellReference: cell.sourceCellReference,
        })),
      };
    }),
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
  const createdTableIds: string[] = [];
  const tables: Prisma.ExtractedTableCreateManyInput[] = [];
  const rows: Prisma.ExtractedTableRowCreateManyInput[] = [];
  const cells: Prisma.ExtractedTableCellCreateManyInput[] = [];

  for (const parsed of parsedTables) {
    const tableId = randomUUID();
    createdTableIds.push(tableId);
    tables.push({
      id: tableId,
      companyId,
      projectFileId,
      sheetName: parsed.sheetName,
      title: parsed.title,
      tableType,
      confidence: parsed.confidence,
      status: ExtractedTableStatus.EXTRACTED,
    });

    const rowIdByRowNumber = new Map<number, string>();
    // Parents are always emitted before their children by the parsers, but sort defensively so parentRowId is always resolvable.
    const orderedRows = [...parsed.rows].sort((a, b) => (a.parentRowNumber ? 1 : 0) - (b.parentRowNumber ? 1 : 0));

    for (const row of orderedRows) {
      const rowId = randomUUID();
      const parentRowId = row.parentRowNumber !== undefined ? rowIdByRowNumber.get(row.parentRowNumber) ?? null : null;
      const rawDataJson = Object.fromEntries(row.cells.map((cell) => [cell.columnKey, cell.rawValue]));
      const headerTitles = Object.fromEntries(
        row.cells.map((cell) => [cell.columnKey, cell.columnTitle ?? cell.columnKey]),
      );

      rows.push({
        id: rowId,
        companyId,
        extractedTableId: tableId,
        rowNumber: row.rowNumber,
        parentRowId,
        rawDataJson: rawDataJson as Prisma.InputJsonValue,
        normalizedDataJson: { headerTitles } as Prisma.InputJsonValue,
        confidence: row.confidence,
        status: ExtractedTableStatus.EXTRACTED,
      });
      // Only top-level rows register themselves as a lookup target for children. A row
      // number can be reused by a same-numbered child (the XLSX parser's merge-group parent
      // and its first physical row share a rowNumber) — never let that child's creation
      // overwrite the true parent's id in this map.
      if (row.parentRowNumber === undefined) rowIdByRowNumber.set(row.rowNumber, rowId);

      for (const cell of row.cells) {
        cells.push({
          id: randomUUID(),
          companyId,
          extractedTableRowId: rowId,
          columnKey: cell.columnKey,
          rawValue: cell.rawValue,
          normalizedValue: cell.normalizedValue,
          confidence: row.confidence,
          sourceCellReference: cell.sourceCellReference,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.extractedTable.deleteMany({ where: { companyId, projectFileId } });
    if (tables.length > 0) await tx.extractedTable.createMany({ data: tables });
    if (rows.length > 0) await tx.extractedTableRow.createMany({ data: rows });
    if (cells.length > 0) await tx.extractedTableCell.createMany({ data: cells });
  });

  return createdTableIds;
}
