---
name: quantara-pdf-export
description: Guide changes to quantara-ai-boq's PDF BOQ and proposal export, implemented in src/lib/documents/generators/pdf-generator.ts using `pdfkit`, plus the manual Arabic text shaping in src/lib/documents/arabic-text.ts. Use this skill whenever editing, debugging, or extending PDF generation in this project — layout/pagination changes, Arabic/RTL rendering issues, font problems, or any "PDF looks wrong" / "PDF build is broken" report. Also use if a build or deploy failure mentions pdfkit, pdf-parse, pdfjs-dist, ENOENT on font/AFM files, or webpack bundling of these packages. Do not use the general PDF-authoring skill for this — this is the production export feature inside quantara-ai-boq, with app-specific font loading and bidi logic.
---

# Quantara AI BOQ — PDF export

## Where this lives
`src/lib/documents/generators/pdf-generator.ts` (`pdfkit`), plus `src/lib/documents/arabic-text.ts`
for Arabic shaping/bidi helpers (`isArabicChar`, `splitScriptRuns`, `toVisualArabic`). Like the Word
generator, this consumes `CanonicalDocumentData` from `build-document-data.ts` — it does not touch
Prisma. Visibility of internal cost fields is governed by `data.boq.showInternalFields`, decided
upstream once for all generators (see the quantara-word-export skill for the full explanation) —
don't add a separate visibility check here.

## Why this file is more complex than the Word generator, and why that's necessary
Unlike Word, `pdfkit` does **not** perform Arabic shaping or bidi reordering on its own — it just
draws whatever glyphs it's given, left to right. So this generator has to do manually what Word
does automatically:
1. Detect Arabic content (`containsArabic`).
2. Convert logical-order text to visual order and apply correct glyph shaping
   (`toVisualArabic` in `arabic-text.ts`).
3. Split mixed Arabic/Latin runs (`splitScriptRuns`) so numbers, Latin brand names, etc. inside
   Arabic text render in the right font and direction.
4. Measure the *visual* (shaped) text width, not the logical string, when wrapping lines
   (`measureVisualWidth`/`wrapArabicText`) — measuring the unshaped string gives wrong wrap points.

If you're adding new Arabic-adjacent text handling here, follow this same shape→measure→wrap
sequence rather than treating Arabic as "just another string" — width and wrapping calculations
done on unshaped text will silently misalign in production even though they look fine in a quick
LTR-only test.

## Fonts are loaded from disk at runtime — this is deliberate
`ARABIC_REGULAR_PATH` / `ARABIC_BOLD_PATH` point into
`node_modules/@fontsource/noto-naskh-arabic/files/...` via `path.join(process.cwd(), ...)`. This
only works if `pdfkit` (and `pdf-parse`, which has the same class of issue) are excluded from
webpack bundling — see `next.config.mjs`'s `experimental.serverComponentsExternalPackages:
["pdfkit", "pdf-parse", "pdfjs-dist"]`, with a comment explaining exactly why. **Do not remove that
exclusion.** If it's ever removed (e.g., during a Next.js upgrade or config cleanup), font loading
breaks with an `ENOENT` at request time, not at build time — so the failure won't show up until
someone actually generates a PDF with Arabic content in a deployed environment. If a bug report
mentions PDF generation working locally but failing after a deploy, check this exclusion first.

## Layout constants
`PAGE_MARGIN` and `CONTENT_BOTTOM` (A4 height minus bottom margin, leaving footer room) anchor the
whole page layout — reuse them for any new section rather than hardcoding new margin values, or
new content will drift out of alignment with the existing footer/pagination logic.

## Before calling a change to this file done
Generate a PDF with real mixed content — Arabic project/client names alongside Latin item codes and
numbers — and visually check wrapping and shaping, not just that the build succeeds. A build that
compiles cleanly can still produce garbled Arabic if the shape/measure/wrap sequence above is
broken. Then run the project's quality gate (lint, build, test) before considering it done.