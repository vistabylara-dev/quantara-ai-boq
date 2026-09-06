import {
  AlignmentType,
  BorderStyle,
  Document,
  type FileChild,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { CanonicalDocumentData } from "../build-document-data";
import type { DocumentTemplateContentConfig, DocumentTemplateStyleConfig } from "../template-config";
import {
  getDocumentItemSpecification,
  getDocumentItemQuantity,
  getDocumentOutputSections,
  shouldRenderDocumentSection,
  shouldRenderSpecification,
} from "../furniture-document-output";
import { fitLogoBox, loadLogoImage, type LogoImageFormat } from "../logo-image";

const DOCX_IMAGE_TYPE: Record<LogoImageFormat, "jpg" | "png"> = { png: "png", jpeg: "jpg" };

export type GenerateDocxInput = {
  data: CanonicalDocumentData;
  style: DocumentTemplateStyleConfig;
  content: DocumentTemplateContentConfig;
};

function formatCurrency(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Word performs its own Arabic shaping and bidi reordering when given
 * logical-order Unicode text plus `bidirectional`/`rightToLeft` formatting
 * properties, so — unlike the PDF generator — no manual reshaping is
 * needed here. "Arial" is used as the RTL font because it ships with
 * Arabic glyph coverage on both Windows and macOS by default.
 */
function textRun(text: string, rtl: boolean, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size,
    color: opts.color,
    rightToLeft: rtl,
    font: rtl ? "Arial" : undefined,
  });
}

function paragraph(text: string, rtl: boolean, opts: { bold?: boolean; size?: number; color?: string; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; spacingAfter?: number } = {}) {
  return new Paragraph({
    heading: opts.heading,
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: opts.spacingAfter ?? 100 },
    children: [textRun(text, rtl, opts)],
  });
}

function cell(text: string, rtl: boolean, opts: { width?: number; header?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { fill: "0B1D3A" } : undefined,
    children: [
      new Paragraph({
        bidirectional: rtl,
        alignment: opts.align ?? (rtl ? AlignmentType.RIGHT : AlignmentType.LEFT),
        children: [
          textRun(text, rtl, { bold: opts.header, size: opts.header ? 16 : 16, color: opts.header ? "FFFFFF" : undefined }),
        ],
      }),
    ],
  });
}

/**
 * Editable Word document. Internal cost columns only appear when
 * `data.boq.showInternalFields` is true, identically to every other
 * generator — visibility is decided once upstream in buildDocumentData.
 */
export async function generateDocx(input: GenerateDocxInput): Promise<Buffer> {
  const { data, style, content } = input;
  const rtl = style.direction === "rtl";
  const showInternal = data.boq.showInternalFields;
  const quantitiesOnly = data.boq.pricingMode === "QUANTITIES_ONLY";
  const showSpecification = shouldRenderSpecification(data, content.columns.specification);
  const logo = await loadLogoImage(data.company.logoUrl);

  const headerCells = [
    "#",
    "Code",
    "Description",
    ...(showSpecification ? [data.furniture ? "Specification / Evidence" : "Spec"] : []),
    "Unit",
    "Qty",
    ...(showInternal ? ["Landed Cost", "Margin %"] : []),
    ...(quantitiesOnly ? [] : ["Rate", "Total"]),
  ];
  if (rtl) headerCells.reverse();

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headerCells.map((label) => cell(label, rtl, { header: true, align: AlignmentType.CENTER })),
    }),
  ];

  for (const section of getDocumentOutputSections(data)) {
    if (!shouldRenderDocumentSection(data, section)) continue;
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: headerCells.length,
            shading: { fill: "E2E8F0" },
            children: [
              new Paragraph({
                bidirectional: rtl,
                alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [textRun(`${section.code} — ${section.title}`, rtl, { bold: true })],
              }),
            ],
          }),
        ],
      }),
    );
    for (const item of section.items) {
      const rowCells = [
        cell(String(item.itemNumber), rtl, { align: AlignmentType.CENTER }),
        cell(item.itemCode, rtl),
        cell(item.description, rtl),
        ...(showSpecification ? [cell(getDocumentItemSpecification(data, item), rtl)] : []),
        cell(item.unit, rtl, { align: AlignmentType.CENTER }),
        cell(getDocumentItemQuantity(data, item), rtl, { align: AlignmentType.RIGHT }),
        ...(showInternal
          ? [
              cell((item.landedCost ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }), rtl, { align: AlignmentType.RIGHT }),
              cell((item.marginPercentage ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 }), rtl, { align: AlignmentType.RIGHT }),
            ]
          : []),
        ...(quantitiesOnly
          ? []
          : [
              cell((item.sellingRate ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }), rtl, { align: AlignmentType.RIGHT }),
              cell((item.totalAmount ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 }), rtl, { align: AlignmentType.RIGHT }),
            ]),
      ];
      if (rtl) rowCells.reverse();
      tableRows.push(new TableRow({ children: rowCells }));
    }
  }

  const boqTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    },
  });

  const children: FileChild[] = [];

  if (data.meta.isDraft) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: style.watermarkDraftText, bold: true, color: "DC2626", size: 24 })],
      }),
    );
  }
  if (data.meta.watermarkText) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: data.meta.watermarkText, bold: true, color: "1D4ED8", size: 20 })],
      }),
    );
  }
  if (quantitiesOnly) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: data.meta.isDraft ? "Draft Quantities — For Scope Review Only (No Pricing)" : "Unpriced BOQ — Rates Excluded", bold: true, color: "B45309", size: 22 })],
      }),
    );
  }

  children.push(paragraph(data.boq.title, rtl, { heading: HeadingLevel.TITLE, spacingAfter: 80 }));
  children.push(
    paragraph(
      `${data.project.reference} · Revision ${data.boq.revision} · ${data.boq.status.toUpperCase()}`,
      rtl,
      { size: 20, spacingAfter: 200 },
    ),
  );

  if (content.showCompanyInfo) {
    if (logo) {
      try {
        const box = fitLogoBox(logo.width, logo.height, 160, 70);
        children.push(
          new Paragraph({
            alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [
              new ImageRun({
                type: DOCX_IMAGE_TYPE[logo.format],
                data: logo.buffer,
                transformation: { width: box.width, height: box.height },
              }),
            ],
          }),
        );
      } catch {
        // A decoder rejection remains non-fatal after network/signature checks.
      }
    }
    children.push(paragraph("From", rtl, { bold: true, size: 18, spacingAfter: 40 }));
    for (const line of [
      data.company.legalName,
      data.company.address ?? "",
      data.company.email,
      data.company.phone ?? "",
      data.company.website ?? "",
      data.company.taxRegistrationNumber ? `TRN: ${data.company.taxRegistrationNumber}` : "",
    ].filter(Boolean)) {
      children.push(paragraph(line, rtl, { size: 18, spacingAfter: 40 }));
    }
  }
  if (content.showProjectInfo) {
    children.push(paragraph("Bill To / Project", rtl, { bold: true, size: 18, spacingAfter: 40 }));
    for (const line of [
      data.client.companyName ?? data.client.name,
      data.project.location,
      `Currency: ${data.project.currency} · Tax rate: ${data.project.taxRate}%`,
    ].filter(Boolean)) {
      children.push(paragraph(line, rtl, { size: 18, spacingAfter: 40 }));
    }
  }

  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  children.push(boqTable);
  children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  if (!quantitiesOnly && data.boq.totals) {
    const totals = data.boq.totals;
    const totalsLines: Array<[string, string, boolean]> = [
      ["Subtotal", formatCurrency(totals.subtotal, data.project.currency), false],
      ["Discount", formatCurrency(totals.discountAmount, data.project.currency), false],
      ["Taxable Amount", formatCurrency(totals.taxableAmount, data.project.currency), false],
      [`VAT (${data.project.taxRate}%)`, formatCurrency(totals.taxAmount, data.project.currency), false],
      ["Grand Total", formatCurrency(totals.grandTotal, data.project.currency), true],
    ];
    for (const [label, value, bold] of totalsLines) {
      children.push(
        new Paragraph({
          alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT,
          bidirectional: rtl,
          spacing: { after: 60 },
          children: [textRun(`${label}: ${value}`, rtl, { bold, size: bold ? 22 : 18 })],
        }),
      );
    }
  }

  // No VAT/payment terms apply before a BOQ has been priced — the "for
  // scope review" banner above already frames the document; Terms &
  // Payment is priced-document content and stays out of this mode entirely.
  if (content.showTermsSection && !quantitiesOnly) {
    children.push(paragraph("Terms & Payment", rtl, { bold: true, size: 20, spacingAfter: 60 }));
    children.push(paragraph(data.boq.termsText, rtl, { size: 18, spacingAfter: 160 }));
  }
  if (content.showExclusionsSection) {
    children.push(paragraph("Exclusions", rtl, { bold: true, size: 20, spacingAfter: 60 }));
    children.push(paragraph(data.boq.exclusionsText, rtl, { size: 18, spacingAfter: 160 }));
  }
  if (content.showSignatureSection) {
    children.push(paragraph("____________________________          ____________________________", rtl, { size: 18, spacingAfter: 40 }));
    children.push(paragraph("Prepared by                                              Client acceptance", rtl, { size: 16 }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT,
                children: [textRun(data.company.tradeName || data.company.legalName, rtl, { size: 16, color: "64748B" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              ...(data.meta.watermarkText
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: data.meta.watermarkText, size: 14, color: "1D4ED8" })],
                    }),
                  ]
                : []),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "94A3B8" }),
                ],
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
