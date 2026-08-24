import { DocumentAudience, GeneratedDocumentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";

export function assertProposalDocumentEligible(document: {
  audience: DocumentAudience;
  status: GeneratedDocumentStatus;
  isDraft: boolean;
}): void {
  if (document.audience !== DocumentAudience.CLIENT) {
    throw new AppError("DOCUMENT_NOT_CLIENT_FACING", "Only client-facing documents can be attached to a proposal.", 400);
  }
  if (document.status !== GeneratedDocumentStatus.COMPLETED) {
    throw new AppError("DOCUMENT_NOT_READY", "Selected documents must finish generating before they can be attached.", 400);
  }
  if (document.isDraft) {
    throw new AppError(
      "DRAFT_DOCUMENT_NOT_PROPOSAL_READY",
      "Draft review documents cannot be attached to a client proposal. Generate a clean final document from the locked revision.",
      409,
    );
  }
}
