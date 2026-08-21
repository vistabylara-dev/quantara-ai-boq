export type ParsedCell = {
  /** Stable normalized key used by downstream services. */
  columnKey: string;
  /** Human-readable full header path, e.g. "Reinforcement > Bottom Steel > Straight". */
  columnTitle?: string;
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
  method:
    | "xlsx-merge-reconstruction"
    | "csv-blank-cell-inheritance"
    | "pdf-grid-detection"
    | "pdf-text-schedule-fallback"
    | "pdf-positional-text-fallback";
};
