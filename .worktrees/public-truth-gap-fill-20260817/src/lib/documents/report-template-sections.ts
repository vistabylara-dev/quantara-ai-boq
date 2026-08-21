import { z } from "zod";

/**
 * Shared shape for a technical report template's content — produced by the template-import
 * tooling (see report-template-service.ts's importTemplateFromSpec) and consumed by both the
 * generation service (report-generation-service.ts) and the DOCX renderer
 * (generators/technical-report-docx-generator.ts). Deliberately generic (headings/paragraphs/
 * tables/callouts) rather than a fixed FM-specific schema, so any future template — an SEO
 * validation appendix, a structural condition report, anything else — fits the same shape.
 */
export const reportTemplateBlockSchema = z.union([
  z.object({
    type: z.enum(["heading", "paragraph", "sectionIntro", "callout"]),
    text: z.string(),
  }).strict(),
  z.object({
    type: z.literal("table"),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }).strict(),
]);

export const reportTemplateSectionSchema = z.object({
  sectionCode: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  blocks: z.array(reportTemplateBlockSchema),
}).strict();

export const reportTemplateSectionsSchema = z.object({
  templateName: z.string().trim().max(255).optional(),
  templateCode: z.string().trim().max(100).optional(),
  sourceDocumentType: z.string().trim().max(50).optional(),
  intendedAppDestination: z.string().trim().max(1000).optional(),
  disciplinesCovered: z.array(z.string()).optional(),
  note: z.string().trim().max(2000).optional(),
  frontMatter: z.array(reportTemplateBlockSchema),
  sections: z.array(reportTemplateSectionSchema),
}).strict();

export type ReportTemplateBlock = z.infer<typeof reportTemplateBlockSchema>;
export type ReportTemplateSection = z.infer<typeof reportTemplateSectionSchema>;
export type ReportTemplateSections = z.infer<typeof reportTemplateSectionsSchema>;

/** Matches "[Anything except closing bracket]" — the bracketed-placeholder convention every
 *  template built so far (both the FM one and the app's own existing [Insert ...] fields) uses. */
const PLACEHOLDER_RE = /\[[^\[\]]+\]/g;

function collectPlaceholdersFromText(text: string, out: Set<string>): void {
  const matches = text.match(PLACEHOLDER_RE);
  if (matches) matches.forEach((m) => out.add(m));
}

function collectPlaceholdersFromBlock(block: ReportTemplateBlock, out: Set<string>): void {
  if (block.type === "table") {
    block.columns.forEach((c) => collectPlaceholdersFromText(c, out));
    block.rows.forEach((row) => row.forEach((cellText) => collectPlaceholdersFromText(cellText, out)));
  } else {
    collectPlaceholdersFromText(block.text, out);
  }
}

/** Every distinct bracketed placeholder in the template, in first-seen order — becomes the list
 *  of fields a user fills in when starting a report from this template. */
export function extractPlaceholders(sections: ReportTemplateSections): string[] {
  const found = new Set<string>();
  sections.frontMatter.forEach((b) => collectPlaceholdersFromBlock(b, found));
  sections.sections.forEach((s) => s.blocks.forEach((b) => collectPlaceholdersFromBlock(b, found)));
  return Array.from(found);
}

function substituteText(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [placeholder, value] of Object.entries(values)) {
    if (!value) continue;
    result = result.split(placeholder).join(value);
  }
  return result;
}

/** Literal find/replace of every placeholder the caller supplied a value for — placeholders left
 *  unfilled stay visible as-is in the output, rather than silently vanishing or being guessed at. */
export function applyFieldValues(sections: ReportTemplateSections, values: Record<string, string>): ReportTemplateSections {
  const mapBlock = (block: ReportTemplateBlock): ReportTemplateBlock => {
    if (block.type === "table") {
      return {
        ...block,
        columns: block.columns.map((c) => substituteText(c, values)),
        rows: block.rows.map((row) => row.map((c) => substituteText(c, values))),
      };
    }
    return { ...block, text: substituteText(block.text, values) };
  };
  return {
    ...sections,
    frontMatter: sections.frontMatter.map(mapBlock),
    sections: sections.sections.map((s) => ({ ...s, blocks: s.blocks.map(mapBlock) })),
  };
}
