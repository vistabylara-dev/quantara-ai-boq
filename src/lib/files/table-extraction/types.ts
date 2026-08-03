export type ParsedCell = {
  columnKey: string;
  rawValue: string;
  normalizedValue?: string;
  sourceCellReference?: string;
};

export type ParsedTableRow = {
  rowNumber: number;
  /** rowNumber of the parent row within the same ParsedTable, if this row is a child. */
  parentRowNumber?: number;
  cells: ParsedCell[];
  confidence: number;
};

export type ParsedTable = {
  sheetName?: string;
  title?: string;
  rows: ParsedTableRow[];
  confidence: number;
  method: "xlsx-merge-reconstruction" | "csv-blank-cell-inheritance" | "pdf-whitespace-heuristic";
};
