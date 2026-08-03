---
name: quantara-excel-export
description: Guide changes to quantara-ai-boq's Excel/.xlsx BOQ export, implemented in src/lib/documents/generators/xlsx-generator.ts using the `exceljs` npm package. Use this skill whenever editing, debugging, or extending the Excel export in this project — new columns, formula changes, formatting/currency changes, or "the spreadsheet numbers don't update" / "Excel export is wrong" reports. Do not confuse this with src/lib/imports/xlsx-parser.ts or src/lib/files/table-extraction/xlsx-table-parser.ts, which handle reading uploaded spreadsheets in — this skill is specifically about generating the output workbook.
---

# Quantara AI BOQ — Excel (.xlsx) export

## Where this lives
`src/lib/documents/generators/xlsx-generator.ts`, using `exceljs`. Like the Word and PDF
generators, it consumes `CanonicalDocumentData` from `build-document-data.ts` and must not
re-derive visibility itself — internal cost/margin columns are included or omitted based on
`data.boq.showInternalFields`, decided once upstream (see quantara-word-export for the full
explanation of this shared rule).

## This export is a live workbook, not a snapshot — formulas matter
The existing code deliberately writes **formulas**, not pre-computed values, for anything derived:
per-item `Total = Quantity * Selling Rate`, and `SUM` formulas for section/grand totals. The intent
(stated directly in the code comment) is that if a user opens the file and edits a quantity in
Excel, the totals recalculate correctly instead of silently going stale. When adding a new
calculated column, write it as a formula referencing the relevant cell(s) by column letter
(`quantityColLetter`, `sellingRateColLetter`, etc. — computed dynamically since column position
shifts depending on `showInternal`), not as a hardcoded number. A new column that outputs a static
computed value instead of a formula will look correct on generation and then quietly go wrong the
moment a user edits any input cell.

## Column positions are conditional — don't hardcode indices
Column count and order change depending on `showInternal`: internal-only columns (Unit Cost,
Freight, Installation, Additional, Landed Cost, Margin %) are inserted only when
`showInternalFields` is true, which shifts every column after them. The existing code computes
`sellingRateColIndex`/`totalColIndex` conditionally for exactly this reason. If you add a new
column, compute its index the same conditional way rather than hardcoding a fixed column number —
a hardcoded index will point at the wrong column whenever the internal/client toggle flips.

## Internal cost data must be fully absent for CLIENT audience, not just hidden
The code comment is explicit: internal cost columns are "omitted entirely for CLIENT-audience
documents," matching the same rule the CSV and PDF generators follow. Hiding a column (e.g., zero
width, hidden flag) is not equivalent to omitting it — a hidden column's data is still present in
the underlying file and can be un-hidden or read by anyone who opens the raw XML. If a client-facing
export needs to exclude internal costs, exclude the column entirely, don't just visually hide it.

## Formatting conventions already established
- Currency cells use the shared `CURRENCY_FMT` (`"#,##0.00"`) number format — apply it consistently
  to new money columns rather than leaving them as plain numbers or inventing a different format
  string.
- Header row uses `HEADER_FILL`/`HEADER_FONT`, section rows use `SECTION_FILL` — reuse these
  constants for visual consistency rather than picking new colors for a new section type.
- The sheet is frozen on the header row and set up for landscape A4-fit printing
  (`pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, ... }`) — preserve this if
  adding columns, and check that a wider table still fits the page setup or adjust `fitToWidth`
  intentionally rather than letting columns silently get cut off when printed.

## Before calling a change to this file done
Open the generated file in an actual spreadsheet app (not just verify it downloads) and edit an
input value (e.g., change a quantity) to confirm dependent totals still recalculate — this is the
one thing that's easy to break silently by replacing a formula with a static value. Then run the
project's quality gate (lint, build, test) before considering the change finished.