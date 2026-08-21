export type ClientProposalSettings = {
  showUnitRates: boolean;
  showSectionTotals: boolean;
  allowOptionSelection: boolean;
  allowComments: boolean;
  allowDocumentDownload: boolean;
  requireApprovalName: boolean;
  requireApprovalEmail: boolean;
  requireAccessPasscode: boolean;
  accessPasscodeHash: string | null;
  clientLanguage: "English" | "Arabic";
  showTerms: boolean;
  showExclusions: boolean;
};

export const DEFAULT_PROPOSAL_SETTINGS: ClientProposalSettings = {
  showUnitRates: true,
  showSectionTotals: true,
  allowOptionSelection: true,
  allowComments: true,
  allowDocumentDownload: true,
  requireApprovalName: true,
  requireApprovalEmail: true,
  requireAccessPasscode: false,
  accessPasscodeHash: null,
  clientLanguage: "English",
  showTerms: true,
  showExclusions: true,
};

export function mergeProposalSettings(overrides: Partial<ClientProposalSettings> | null | undefined): ClientProposalSettings {
  return { ...DEFAULT_PROPOSAL_SETTINGS, ...(overrides ?? {}) };
}
