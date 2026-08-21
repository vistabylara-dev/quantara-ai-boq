import type { ParsedCell, ParsedTable, ParsedTableRow } from "./types";
import { normalizeColumnKey } from "./column-normalization";

const FALLBACK_CONFIDENCE = 50;

type CellSpec = { title: string; value: string };

function cell(spec: CellSpec, pageNumber: number, rowNumber: number, index: number): ParsedCell {
  return {
    columnKey: normalizeColumnKey(spec.title, index),
    columnTitle: spec.title,
    rawValue: spec.value.trim(),
    sourceCellReference: `page ${pageNumber}, text schedule row ${rowNumber}, ${spec.title}`,
  };
}

function makeRow(
  specs: CellSpec[],
  pageNumber: number,
  rowNumber: number,
): ParsedTableRow {
  return {
    rowNumber,
    confidence: FALLBACK_CONFIDENCE,
    cells: specs
      .map((spec, index) => cell(spec, pageNumber, rowNumber, index))
      .filter((entry) => entry.rawValue !== ""),
  };
}

function parseFootingRow(line: string, pageNumber: number, rowNumber: number): ParsedTableRow | null {
  const match = line.match(
    /^(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/,
  );
  if (!match) return null;

  return makeRow([
    { title: "Type", value: match[1] },
    { title: "R.C.C Dimensions (cm) > L", value: match[2] },
    { title: "R.C.C Dimensions (cm) > B", value: match[3] },
    { title: "R.C.C Dimensions (cm) > D", value: match[4] },
    { title: "Reinforcement > Bottom Steel > Long Span", value: match[5] },
    { title: "Reinforcement > Bottom Steel > Short Span", value: match[6] },
    { title: "Reinforcement > Top Steel > Long Span", value: match[7] },
    { title: "Reinforcement > Top Steel > Short Span", value: match[8] },
    { title: "Notes / Load", value: match[9] ?? "" },
  ], pageNumber, rowNumber);
}

const BAR = String.raw`(?:----|\d+\s*T\s*\d+)`;
const STIRRUP = String.raw`(?:----|T\d+\s*@\s*\d+(?:\.\d+)?\s*cm(?:\s*C\/C)?)`;
const BEAM_ROW = new RegExp(
  String.raw`^(\S+)\s+(\d+(?:\.\d+)?\s*[Xx×]\s*\d+(?:\.\d+)?)\s+(${BAR})\s+(${BAR})\s+(${BAR})\s+(${BAR})\s+(${BAR})\s+(${STIRRUP})(?:\s+(.+))?$`,
  "i",
);

function parseBeamRow(line: string, pageNumber: number, rowNumber: number): ParsedTableRow | null {
  const match = line.match(BEAM_ROW);
  if (!match) return null;

  return makeRow([
    { title: "Type", value: match[1] },
    { title: "Dimensions (cm)", value: match[2] },
    { title: "Reinforcement > Bottom Steel > Straight", value: match[3] },
    { title: "Reinforcement > Bottom Steel > Extra at Support", value: match[4] },
    { title: "Reinforcement > Top Steel > Straight", value: match[5] },
    { title: "Reinforcement > Top Steel > Extra at Support", value: match[6] },
    { title: "Reinforcement > Side Bars for Each Side", value: match[7] },
    { title: "Reinforcement > Stirrups", value: match[8] },
    { title: "Notes", value: match[9] ?? "" },
  ], pageNumber, rowNumber);
}

function scheduleBlocks(text: string): Array<{ title: string; lines: string[] }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^SCHEDULE OF\b/i.test(line));

  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    return { title: start.line, lines: lines.slice(start.index + 1, end) };
  });
}

export function parseStructuralScheduleTextFallback(
  text: string,
  pageNumber: number,
): ParsedTable[] {
  const tables: ParsedTable[] = [];

  for (const block of scheduleBlocks(text)) {
    const upper = block.title.toUpperCase();
    let parser: ((line: string, pageNumber: number, rowNumber: number) => ParsedTableRow | null) | null = null;

    if (upper.includes("FOOTING")) {
      parser = parseFootingRow;
    } else if (upper.includes("BEAM")) {
      parser = parseBeamRow;
    }

    if (!parser) continue;

    const rows: ParsedTableRow[] = [];
    block.lines.forEach((line, index) => {
      const parsed = parser!(line, pageNumber, index + 1);
      if (parsed) rows.push(parsed);
    });

    if (rows.length > 0) {
      tables.push({
        title: block.title,
        confidence: FALLBACK_CONFIDENCE,
        method: "pdf-text-schedule-fallback",
        rows,
      });
    }
  }

  return tables;
}
