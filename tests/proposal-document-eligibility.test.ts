import { DocumentAudience, GeneratedDocumentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertProposalDocumentEligible } from "@/lib/proposals/proposal-document-eligibility";

describe("proposal document eligibility", () => {
  it("accepts only completed, client-facing, final documents", () => {
    expect(() => assertProposalDocumentEligible({ audience: DocumentAudience.CLIENT, status: GeneratedDocumentStatus.COMPLETED, isDraft: false })).not.toThrow();
  });

  it("rejects draft review evidence", () => {
    expect(() => assertProposalDocumentEligible({ audience: DocumentAudience.CLIENT, status: GeneratedDocumentStatus.COMPLETED, isDraft: true })).toThrowError(
      expect.objectContaining({ code: "DRAFT_DOCUMENT_NOT_PROPOSAL_READY" }),
    );
  });

  it("rejects unfinished or internal documents", () => {
    expect(() => assertProposalDocumentEligible({ audience: DocumentAudience.CLIENT, status: GeneratedDocumentStatus.GENERATING, isDraft: false })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_NOT_READY" }),
    );
    expect(() => assertProposalDocumentEligible({ audience: DocumentAudience.INTERNAL, status: GeneratedDocumentStatus.COMPLETED, isDraft: false })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_NOT_CLIENT_FACING" }),
    );
  });
});
