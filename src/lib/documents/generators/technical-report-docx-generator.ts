import {
  AlignmentType,
  BorderStyle,
  Document,
  type FileChild,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportTemplateBlock, ReportTemplateSections } from "@/lib/documents/report-template-sections";

export type GenerateTechnicalReportDocxInput = {
  reportName: string;
  companyName: string;
  projectName: string;
  sections: ReportTemplateSections;
};

function textRun(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size });
}

function bodyParagraph(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; spacingAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [textRun(text, opts)],
  });
}

function calloutParagraph(text: string) {
  return new Paragraph({
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: "C99A44" } },
    indent: { left: 200 },
    spacing: { before: 120, after: 160 },
    shading: { fill: "F5F1E8" },
    children: [textRun(text, { size: 20, color: "5C4A24" })],
  });
}

function headerCell(text: string) {
  return new TableCell({
    shading: { fill: "0B1D3A" },
    children: [new Paragraph({ children: [textRun(text, { bold: true, size: 18, color: "FFFFFF" })] })],
  });
}

function dataCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [textRun(text, { size: 18 })] })],
  });
}

function blockTable(columns: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: columns.map(headerCell) }),
      ...rows.map((row) => new TableRow({ children: row.map(dataCell) })),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    },
  });
}

function renderBlock(block: ReportTemplateBlock): FileChild[] {
  switch (block.type) {
    case "heading":
      return [new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 100 }, children: [textRun(block.text, { bold: true })] })];
    case "sectionIntro":
      return [bodyParagraph(block.text, { italics: true, size: 20, color: "64748B", spacingAfter: 160 })];
    case "callout":
      return [calloutParagraph(block.text)];
    case "paragraph":
      return [bodyParagraph(block.text, { size: 20 })];
    case "table":
      return [blockTable(block.columns, block.rows), new Paragraph({ spacing: { after: 160 }, children: [] })];
    default:
      return [];
  }
}

/**
 * Renders a technical report from its (already field-value-substituted) section snapshot into a
 * real Word document. Deliberately generic — walks whatever sections/blocks the template
 * contains — so it works for the FM template, a future marketing-validation template, or anything
 * else built on the same report-template-sections.ts shape, with no per-template-specific code.
 */
export async function generateTechnicalReportDocx(input: GenerateTechnicalReportDocxInput): Promise<Buffer> {
  const { reportName, companyName, projectName, sections } = input;

  const children: FileChild[] = [];

  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 80 }, children: [textRun(sections.templateName ?? reportName, { bold: true })] }),
  );
  children.push(
    new Paragraph({ spacing: { after: 300 }, children: [textRun(`${projectName} · Prepared by ${companyName}`, { size: 20, color: "64748B" })] }),
  );

  for (const block of sections.frontMatter) {
    children.push(...renderBlock(block));
  }

  for (const section of sections.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 140 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "0B1D3A" } },
        children: [textRun(`${section.sectionCode}  ${section.title}`, { bold: true, size: 26 })],
      }),
    );
    for (const block of section.blocks) {
      children.push(...renderBlock(block));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [textRun(companyName, { size: 16, color: "64748B" })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "94A3B8" })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
