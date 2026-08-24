import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocumentData, type BuildDocumentDataInput } from "@/lib/documents/build-document-data";
import { generateDocx } from "@/lib/documents/generators/docx-generator";
import { DEFAULT_CONTENT_CONFIG, DEFAULT_STYLE_CONFIG, mergeContentConfig, mergeStyleConfig } from "@/lib/documents/template-config";
import type { BOQ } from "@/types/boq";

const root = path.resolve(__dirname, "..");
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8").replace(/\r\n/g, "\n");

const sampleBoq: BOQ = {
  id: "boq-1",
  projectId: "project-1",
  title: "TAYQAN Draft BOQ",
  revision: "R01",
  status: "draft",
  taxRate: 5,
  isLocked: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  lockedAt: undefined,
  sections: [
    {
      id: "sec-1",
      code: "FND",
      title: "Foundations",
      description: "",
      order: 1,
      items: [
        {
          id: "item-1",
          itemNumber: 1,
          itemCode: "CON-001",
          category: "Concrete",
          description: "Reinforced footing, includes rebar, ties",
          specification: "C40 concrete",
          quantity: 25,
          unit: "m3",
          unitCost: 320,
          freightCost: 15,
          installationCost: 10,
          additionalCost: 0,
          landedCost: 345,
          marginMode: "markup",
          marginPercentage: 20,
          sellingRate: 414,
          totalAmount: 10350,
          wastagePercentage: 0,
          taxApplicable: true,
          sourceReference: "",
          roomOrZone: "Block A",
          drawingReference: "S-101",
          confidenceScore: 95,
          status: "confirmed",
          notes: "",
          options: [],
        },
      ],
    },
  ],
  totals: {
    directCost: 8625,
    landedCost: 8625,
    grossProfit: 1725,
    grossMarginPercentage: 16.67,
    subtotal: 10350,
    discountPercentage: 0,
    discountAmount: 0,
    taxableAmount: 10350,
    taxAmount: 517.5,
    grandTotal: 10867.5,
  },
};

const baseInput: Omit<BuildDocumentDataInput, "audience"> = {
  company: {
    legalName: "Quantara Contracting LLC",
    tradeName: "Quantara",
    email: "hello@quantara.example",
    phone: "+971-4-555-0100",
    website: "quantara.example",
    address: "Dubai, UAE",
    taxRegistrationNumber: "100123456700003",
    defaultCurrency: "AED",
  },
  client: {
    name: "Gulf Business Towers",
    companyName: "Gulf Business Towers LLC",
    email: "projects@gulfbt.com",
    phone: "+971-4-555-0200",
    address: "Business Bay, Dubai",
    taxRegistrationNumber: null,
  },
  project: {
    name: "Gulf Towers Fit-Out",
    reference: "GBT-2026-001",
    location: "Dubai, UAE",
    currency: "AED",
    taxRate: 5,
    language: "English",
  },
  industryName: "Construction",
  boq: sampleBoq,
  revisionNumber: 1,
  templateName: "Corporate Technical",
  documentType: "DOCX",
  generatedByName: "Test Runner",
  generatedAt: new Date("2026-01-01T00:00:00.000Z"),
  isDraft: true,
};

const style = mergeStyleConfig(DEFAULT_STYLE_CONFIG);
const content = mergeContentConfig(DEFAULT_CONTENT_CONFIG);

describe("TAYQAN Draft BOQ Word export — QUANTITIES_ONLY mode (mission 1)", () => {
  it("omits totalAmount, totals, unit rate, and the pricing disclaimer from CanonicalDocumentData entirely", () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT", pricingMode: "QUANTITIES_ONLY" });

    expect(data.boq.pricingMode).toBe("QUANTITIES_ONLY");
    expect(data.boq.totals).toBeUndefined();
    expect("totals" in data.boq).toBe(false);

    for (const section of data.boq.sections) {
      for (const item of section.items) {
        expect(item.totalAmount).toBeUndefined();
        expect(item.sellingRate).toBeUndefined();
        expect("totalAmount" in item).toBe(false);
        expect("sellingRate" in item).toBe(false);
        // No internal commercial fields either, regardless of audience.
        expect(item.unitCost).toBeUndefined();
        expect(item.landedCost).toBeUndefined();
        expect(item.marginPercentage).toBeUndefined();
      }
    }

    // The VAT/payment disclaimer is never included in quantities-only mode.
    expect(data.boq.termsText).toBe("");
    expect(data.boq.termsText).not.toContain("VAT");
    expect(data.boq.termsText).not.toContain("Payment");
  });

  it("labels the generated DOCX clearly as a draft, unpriced, scope-review document", async () => {
    const data = buildDocumentData({ ...baseInput, audience: "CLIENT", pricingMode: "QUANTITIES_ONLY" });
    const buffer = await generateDocx({ data, style, content });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).toContain("For Scope Review Only");
    expect(xml).toContain("CON-001");
    // No pricing anywhere in the rendered document.
    expect(xml).not.toContain("Grand Total");
    expect(xml).not.toContain("Rate</w:t>");
    expect(xml).not.toContain("Subtotal");
    expect(xml).not.toContain("Terms &amp; Payment");
    expect(xml).not.toContain("414.00");
    expect(xml).not.toContain("10,350.00");
  });
});

describe("TAYQAN Draft BOQ Word export — WITH_PRICES regression proof (mission 6)", () => {
  it("produces byte-identical CanonicalDocumentData whether pricingMode is omitted (default) or explicitly WITH_PRICES", () => {
    const implicit = buildDocumentData({ ...baseInput, audience: "CLIENT" });
    const explicit = buildDocumentData({ ...baseInput, audience: "CLIENT", pricingMode: "WITH_PRICES" });
    expect(implicit).toEqual(explicit);

    // And every existing (priced) field is still populated exactly as before.
    expect(implicit.boq.pricingMode).toBe("WITH_PRICES");
    expect(implicit.boq.totals?.grandTotal).toBe(10867.5);
    expect(implicit.boq.sections[0]!.items[0]!.sellingRate).toBe(414);
    expect(implicit.boq.sections[0]!.items[0]!.totalAmount).toBe(10350);
    expect(implicit.boq.termsText).toContain("VAT");
  });

  it("renders byte-identical DOCX content whether pricingMode is omitted (default) or explicitly WITH_PRICES", async () => {
    const implicitData = buildDocumentData({ ...baseInput, audience: "INTERNAL" });
    const explicitData = buildDocumentData({ ...baseInput, audience: "INTERNAL", pricingMode: "WITH_PRICES" });

    const implicitBuffer = await generateDocx({ data: implicitData, style, content });
    const explicitBuffer = await generateDocx({ data: explicitData, style, content });

    // The raw .docx (a zip container) embeds a per-build timestamp even for
    // byte-for-byte identical content, so the meaningful "byte-identical
    // output" proof is the actual rendered document content inside it
    // (word/document.xml) — every visible byte a reader would see.
    const implicitXml = await (await JSZip.loadAsync(implicitBuffer)).file("word/document.xml")!.async("string");
    const explicitXml = await (await JSZip.loadAsync(explicitBuffer)).file("word/document.xml")!.async("string");
    expect(implicitXml).toBe(explicitXml);

    // And the priced document still renders totals/rates exactly as before —
    // the new QUANTITIES_ONLY branch never engages for WITH_PRICES data.
    expect(implicitXml).toContain("Grand Total");
    expect(implicitXml).toContain("CON-001");
    expect(implicitXml).not.toContain("For Scope Review Only");
  });
});

describe("TAYQAN Draft BOQ Word export — service wiring (mission 3)", () => {
  it("adds pricingMode as an additive, default-preserving schema field", () => {
    const source = read("src", "lib", "validation", "document-schema.ts");
    expect(source).toContain('pricingMode: z.enum(["WITH_PRICES", "QUANTITIES_ONLY"]).default("WITH_PRICES")');
  });

  it("exempts only DOCX + QUANTITIES_ONLY from the locked-revision requirement — every other FINAL_ONLY_TYPES case is unchanged", () => {
    const source = read("src", "lib", "services", "document-generation-service.ts");
    expect(source).toContain('input.documentType === GeneratedDocumentType.DOCX && input.pricingMode === "QUANTITIES_ONLY"');
    expect(source).toContain("FINAL_ONLY_TYPES.includes(input.documentType) && isDraft && !isQuantitiesOnlyDraftDocx");
    // Still throws for a draft PDF/XLSX, and for a draft WITH_PRICES DOCX.
    expect(source).toContain("LOCKED_REVISION_REQUIRED");
  });

  it("threads pricingMode from the parsed request into buildDocumentData", () => {
    const source = read("src", "lib", "services", "document-generation-service.ts");
    expect(source).toContain('pricingMode: input.pricingMode ?? "WITH_PRICES"');
  });
});

describe("TAYQAN Draft BOQ Word export — panel entry point (mission 4)", () => {
  it("is visible once the linked BOQ has generated AI Draft content, not gated on READY_FOR_ACCEPTANCE", () => {
    const source = read("src", "components", "tayqan", "tayqan-work-order-panel.tsx");
    const bannerIndex = source.indexOf(
      "{state.boqId && state.aiDraft && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0) && (",
    );
    const readyIndex = source.indexOf('state.status === "READY_FOR_ACCEPTANCE"');
    expect(bannerIndex).toBeGreaterThan(-1);
    // The export block is its own top-level condition on state.boqId, not
    // nested inside the READY_FOR_ACCEPTANCE-only block.
    expect(bannerIndex).toBeLessThan(readyIndex);
  });

  it("calls the existing generate-document route with the work order's BOQ id and QUANTITIES_ONLY pricing mode, reusing the existing document infra", () => {
    const source = read("src", "components", "tayqan", "tayqan-work-order-panel.tsx");
    expect(source).toContain("/documents/generate");
    expect(source).toContain("boqId: state.boqId");
    expect(source).toContain('documentType: "DOCX"');
    expect(source).toContain('pricingMode: "QUANTITIES_ONLY"');
    expect(source).toContain('apiClient.get<DocumentTemplateSummary[]>("/api/templates")');
  });

  it("provides a download link once the export completes", () => {
    const source = read("src", "components", "tayqan", "tayqan-work-order-panel.tsx");
    expect(source).toContain("/api/documents/${encodeURIComponent(exportedDocumentId)}/download");
  });
});

describe("TAYQAN Draft BOQ Word export — mission item 5 (PR1 exception ledger)", () => {
  it("is skipped: PR1 (tayqan/pr1-correctness-completion-safety) was not merged into main at the time this branch was built", () => {
    // This branch was built directly on origin/main (0de7e47, PR #75) per
    // the instruction's own fallback ("if it hasn't merged yet, this
    // instruction does NOT depend on it"). progress.measurementExceptions
    // does not exist on main yet, so no exception-ledger surfacing was
    // implemented — reconstructing PR1's model here was explicitly out of
    // scope per the instruction.
    expect(true).toBe(true);
  });
});
