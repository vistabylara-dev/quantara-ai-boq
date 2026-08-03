---
name: quantara-word-export
description: Guide changes to quantara-ai-boq's Word/.docx BOQ and proposal export, implemented in src/lib/documents/generators/docx-generator.ts using the `docx` npm package. Use this skill whenever editing, debugging, or extending Word document generation in this project — new fields on the export, styling changes, RTL/Arabic layout issues, header/footer/page-number changes, or "the Word doc looks wrong" reports. Do not use this for the general docx-authoring skill meant for one-off deliverables outside this app; this is specifically about the production export feature inside quantara-ai-boq.
---

# Quantara AI BOQ — Word (.docx) export

## Where this lives
`src/lib/documents/generators/docx-generator.ts`, using the `docx` package (`Document`, `Packer`,
`Paragraph`, `TextRun`, `Table`, etc.). It consumes a `CanonicalDocumentData` object — it does not
read from Prisma or any repository directly. If the export is missing a field, the fix is almost
always in `src/lib/documents/build-document-data.ts` (adding the field to `CanonicalDocumentData`),
not in the generator itself.

## The one rule that matters most: don't decide visibility here
Whether internal cost/margin fields (unit cost, freight, installation, landed cost, margin %)
appear in a document is decided **once, upstream**, in `build-document-data.ts` via
`data.boq.showInternalFields` (true for `INTERNAL` audience, or when a template explicitly opts a
client in via `showInternalCostFieldsToClient`). The Word, PDF, Excel, CSV, and HTML generators all
read this same flag — they do not independently re-derive who should see what. If you add a new
sensitive field to the export, gate it on `showInternalFields` exactly the way the existing cost
fields are gated, rather than adding a new visibility check inside `docx-generator.ts` — a
generator-local visibility decision is how a client ends up seeing internal margins by accident.

## RTL / Arabic handling — simpler than the PDF generator, and that's intentional
Unlike the PDF generator, this file does **not** manually reshape Arabic text. The code comment in
`textRun()` explains why: Word performs its own Arabic shaping and bidi reordering when given plain
logical-order Unicode text plus the `bidirectional`/`rightToLeft` formatting properties. So the
pattern here is: pass ordinary text, set `rightToLeft: rtl` and `bidirectional: rtl` on the
`TextRun`/`Paragraph`, and use `"Arial"` as the RTL font (chosen because it ships with Arabic glyph
coverage on both Windows and macOS by default — don't swap in a font without checking Arabic
coverage on both platforms). If you find yourself trying to pre-shape or reorder Arabic text before
handing it to `docx`, that's almost certainly wrong here — that complexity belongs to the PDF path,
not this one, because Word's renderer already does it.

## Layout conventions already established
- Currency formatting goes through the local `formatCurrency()` helper (`toLocaleString` with fixed
  2-decimal places) — reuse it rather than formatting numbers ad hoc elsewhere in this file, so
  every currency value in the document is consistent.
- Alignment follows text direction: RTL content is right-aligned, LTR is left-aligned — this is
  handled via the `rtl` parameter already threaded through `paragraph()`/`cell()`, don't hardcode
  alignment separately from that flag.
- Headers, footers, and page numbers use the `docx` package's `Header`/`Footer`/`PageNumber`
  primitives — extend these rather than hand-rolling page-number text, since `PageNumber` stays
  correct across repagination and a hardcoded string won't.

## Before calling a change to this file done
Generate a document with both an LTR (English) and RTL (Arabic) project/client to confirm layout
holds in both directions — a change that only gets tested in one language direction is not fully
tested, given how central the bidi handling is to this feature. Then run the project's quality
gate (lint, build, test) as usual before considering the change finished.