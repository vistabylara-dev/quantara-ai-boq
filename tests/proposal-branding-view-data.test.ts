import { describe, expect, it } from "vitest";
import {
  buildProposalViewData,
  buildTechnicalReportProposalViewData,
} from "../src/lib/proposals/build-proposal-view-data";
import { DEFAULT_PROPOSAL_SETTINGS } from "../src/lib/proposals/proposal-settings";
import type { BOQ } from "../src/types/boq";

const logoUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const company = {
  legalName: "Quantara Acceptance LLC",
  tradeName: "Quantara Acceptance",
  logoUrl,
  address: "Dubai, UAE",
  email: "acceptance@example.com",
  phone: "+971 4 000 0000",
  website: "https://acceptance.example.com",
  taxRegistrationNumber: "100000000000003",
};
const client = { name: "Acceptance Client", companyName: "Acceptance Client LLC" };

describe("client proposal branding view data", () => {
  it("carries the validated company logo and details into a BOQ proposal view", () => {
    const boq: BOQ = {
      id: "boq-1",
      projectId: "project-1",
      title: "Acceptance BOQ",
      revision: "R01",
      status: "locked",
      sections: [],
      totals: {
        directCost: 0,
        landedCost: 0,
        grossProfit: 0,
        grossMarginPercentage: 0,
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        taxableAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
      },
      createdAt: "2026-08-30T00:00:00.000Z",
    };

    const view = buildProposalViewData({
      company,
      client,
      project: {
        name: "Acceptance Project",
        reference: "ACC-001",
        location: "Dubai",
        currency: "AED",
        taxRate: 5,
        industryName: "Construction",
      },
      boq,
      revisionNumber: 1,
      settings: DEFAULT_PROPOSAL_SETTINGS,
      selectedOptions: {},
    });

    expect(view.company).toMatchObject({
      logoUrl,
      address: company.address,
      email: company.email,
      phone: company.phone,
      website: company.website,
      taxRegistrationNumber: company.taxRegistrationNumber,
    });
  });

  it("carries the same branding contract into a technical-report proposal view", () => {
    const view = buildTechnicalReportProposalViewData({
      company,
      client,
      project: {
        name: "Acceptance Project",
        reference: "ACC-001",
        location: "Dubai",
        currency: "AED",
        industryName: "Construction",
      },
      report: {
        id: "report-1",
        name: "Acceptance Report",
        templateName: "Technical Report",
        documentType: "DOCX",
        fileName: "acceptance-report.docx",
        fileSize: 1024,
        completedAt: "2026-08-30T00:00:00.000Z",
      },
      settings: DEFAULT_PROPOSAL_SETTINGS,
    });

    expect(view.company).toMatchObject({
      logoUrl,
      address: company.address,
      email: company.email,
      phone: company.phone,
      website: company.website,
      taxRegistrationNumber: company.taxRegistrationNumber,
    });
  });
});
