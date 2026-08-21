import { normalizeColumnKey } from "./column-normalization";
import type { ParsedCell, ParsedTable } from "./types";

const DEFAULT_CONFIDENCE = 65;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function nonEmptyCells(row: string[]): Array<{ index: number; value: string }> {
  const out: Array<{ index: number; value: string }> = [];
  row.forEach((value, index) => {
    const trimmed = clean(value);
    if (trimmed) out.push({ index, value: trimmed });
  });
  return out;
}

function looksLikeTitleRow(row: string[]): boolean {
  const values = nonEmptyCells(row);
  if (values.length !== 1) return false;
  return /\b(schedule|table|summary|legend)\b/i.test(values[0].value);
}

function looksDataLike(value: string): boolean {
  const v = clean(value);
  if (!v) return false;
  if (/^[()]*\s*(cm|mm|m|m2|m3|kn|n\/mm2)\s*[()]*$/i.test(v)) return false;
  if (/\d/.test(v) && /^[A-Za-z]{0,8}\d[\w*./@+\-\s]*$/i.test(v)) return true;
  if (/^[+-]?(?:\d|\.\d)/.test(v)) return true;
  if (/\bT\d+\b/i.test(v) || /\d+\s*T\s*\d+/i.test(v)) return true;
  if (/\d+\s*[xX×]\s*\d+/.test(v)) return true;
  return false;
}

function findDataStartIndex(rows: string[][]): number {
  for (let index = 1; index < rows.length; index += 1) {
    const values = nonEmptyCells(rows[index]).map((entry) => entry.value);
    if (values.length === 0) continue;
    const dataLike = values.filter(looksDataLike).length;
    const first = values[0];
    const firstLooksIdentifier =
      /^[A-Za-z]{1,10}\d[\w*.-]*$/i.test(first)
      || /^[+-]?\d/.test(first);
    if (dataLike >= 2 && (firstLooksIdentifier || dataLike >= Math.min(3, values.length))) {
      return index;
    }
  }
  return Math.min(1, Math.max(0, rows.length - 1));
}

function appendUnique(path: string[], value: string): void {
  if (!value) return;
  if (path[path.length - 1]?.toLowerCase() === value.toLowerCase()) return;
  path.push(value);
}

function buildHeaderPaths(headerRows: string[][], columnCount: number): string[][] {
  const paths = Array.from({ length: columnCount }, () => [] as string[]);

  for (const row of headerRows) {
    const padded = Array.from({ length: columnCount }, (_, index) => clean(row[index]));
    const nonEmpty = padded
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value !== "");

    for (let itemIndex = 0; itemIndex < nonEmpty.length; itemIndex += 1) {
      const { value, index } = nonEmpty[itemIndex];
      const nextIndex = nonEmpty[itemIndex + 1]?.index ?? columnCount;
      const parentSignature = paths[index].join("\u001f");

      for (let col = index; col < nextIndex; col += 1) {
        if (
          col > index
          && paths[col].length > 0
          && paths[col].join("\u001f") !== parentSignature
        ) {
          break;
        }
        appendUnique(paths[col], value);
      }
    }
  }

  return paths;
}

function uniqueColumnKeys(paths: string[][]): Array<{ key: string; title: string }> {
  const used = new Map<string, number>();

  return paths.map((path, index) => {
    const title = path.length > 0 ? path.join(" > ") : `Column ${index + 1}`;
    const baseKey = normalizeColumnKey(title, index);
    const seen = used.get(baseKey) ?? 0;
    used.set(baseKey, seen + 1);
    return {
      key: seen === 0 ? baseKey : `${baseKey}_${seen + 1}`,
      title,
    };
  });
}

export function parsePdfGridTable(
  rows: string[][],
  pageNumber: number,
  tableIndex: number,
  confidence = DEFAULT_CONFIDENCE,
): ParsedTable | null {
  const normalizedRows = rows
    .map((row) => row.map((cell) => clean(cell)))
    .filter((row) => row.some((cell) => cell !== ""));

  if (normalizedRows.length < 2) return null;

  const dataStartIndex = findDataStartIndex(normalizedRows);
  if (dataStartIndex <= 0 || dataStartIndex >= normalizedRows.length) return null;

  const rawHeaderRows = normalizedRows.slice(0, dataStartIndex);
  const titleRows = rawHeaderRows.filter(looksLikeTitleRow);
  const headerRows = rawHeaderRows.filter((row) => !looksLikeTitleRow(row));
  if (headerRows.length === 0) return null;

  const columnCount = Math.max(
    ...normalizedRows.map((row) => row.length),
    1,
  );

  const headerPaths = buildHeaderPaths(headerRows, columnCount);
  const columns = uniqueColumnKeys(headerPaths);

  const parsedRows = normalizedRows
    .slice(dataStartIndex)
    .map((row, relativeIndex) => {
      const absoluteRowNumber = dataStartIndex + relativeIndex + 1;
      const cells: ParsedCell[] = columns
        .map((column, colIndex) => ({
          columnKey: column.key,
          columnTitle: column.title,
          rawValue: clean(row[colIndex]),
          sourceCellReference:
            `page ${pageNumber}, table ${tableIndex + 1}, row ${absoluteRowNumber}, ${column.title}`,
        }))
        .filter((cell) => cell.rawValue !== "");

      return {
        rowNumber: absoluteRowNumber,
        confidence,
        cells,
      };
    })
    .filter((row) => row.cells.length > 0);

  if (parsedRows.length === 0) return null;

  const explicitTitle = titleRows
    .flatMap((row) => nonEmptyCells(row).map((entry) => entry.value))
    .find(Boolean);

  return {
    title: explicitTitle ?? columns.map((column) => column.title).join(" | "),
    confidence,
    method: "pdf-grid-detection",
    rows: parsedRows,
  };
}
