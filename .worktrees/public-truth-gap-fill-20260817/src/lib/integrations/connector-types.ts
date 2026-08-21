import type { IntegrationConnectionType, IntegrationProviderStatus } from "@prisma/client";

/**
 * INTEGRATIONS-1A — the reusable connector contract (spec: "Suggested
 * provider interface... Do not hardcode all connector logic inside React
 * components"). No concrete implementation exists yet in this phase — every
 * live connector (Autodesk in 1B, Microsoft/Google in 1C, Procore/Trimble in
 * 1D, Bentley/Bluebeam in 1E, Archicad bridge in 1F) implements this
 * interface. The marketplace UI and API routes in 1A only ever read the
 * static provider registry below; they never call any of these methods.
 */

export type IntegrationCategory =
  | "BIM_CAD"
  | "CONSTRUCTION_MANAGEMENT"
  | "COMMON_DATA_ENVIRONMENTS"
  | "DOCUMENTS_STORAGE"
  | "ESTIMATING_COST"
  | "STRUCTURAL_ENGINEERING"
  | "VISUALIZATION_RENDERING";

export type ProviderRegistryEntry = {
  /** Stable key, also the IntegrationProvider.id row this seeds. */
  id: string;
  /** Groups related products under one connection foundation (spec: "Revit, AutoCAD and 3ds Max ... within the Autodesk ecosystem, not nine unrelated OAuth implementations"). */
  providerFamily: string;
  familyDisplayName: string;
  displayName: string;
  category: IntegrationCategory;
  connectionType: IntegrationConnectionType;
  status: IntegrationProviderStatus;
  shortPurpose: string;
  description: string;
  supportedData: string[];
  plannedData: string[];
  /** Lower = shown earlier in the "Recommended" section; null = not recommended. */
  recommendedOrder: number | null;
  /** A lucide-react icon name — never a scraped/unapproved logo (spec: "Do not scrape logos from search results"). */
  icon: string;
  /** True unless Quantara has a confirmed official partnership — controls the "Independent integration" disclaimer. */
  isIndependentIntegration: boolean;
};

export type ProviderConnectionSummary = {
  externalConnectionId: string;
  status: string;
  providerAccountId: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  lastErrorMessage: string | null;
};

/**
 * Not implemented by anything in INTEGRATIONS-1A. Defines the shape every
 * future connector (1B+) must satisfy so the marketplace/API layer never
 * needs connector-specific branches.
 */
export interface IntegrationConnector {
  readonly providerId: string;
  readonly providerFamily: string;
  readonly displayName: string;
  readonly category: IntegrationCategory;
  readonly connectionType: IntegrationConnectionType;
  readonly capabilities: string[];
  getStatus(companyId: string): Promise<IntegrationProviderStatus | "CONNECTED" | "REAUTH_REQUIRED" | "ERROR">;
  initiateConnection(companyId: string, userId: string): Promise<{ redirectUrl: string; state: string }>;
  handleCallback(companyId: string, params: Record<string, string>): Promise<{ externalConnectionId: string }>;
  refreshCredentials(externalConnectionId: string): Promise<void>;
  listAccounts(externalConnectionId: string): Promise<ExternalProject[]>;
  listProjects(externalConnectionId: string, accountId: string): Promise<ExternalProject[]>;
  listFolders(externalConnectionId: string, projectId: string, parentFolderId?: string): Promise<{ id: string; name: string }[]>;
  listFiles(externalConnectionId: string, folderId: string): Promise<ExternalFile[]>;
  getFileVersion(externalConnectionId: string, fileId: string, versionId?: string): Promise<ExternalVersion>;
  synchronizeSource(projectIntegrationId: string): Promise<{ inserted: number; updated: number; skipped: number }>;
  disconnect(externalConnectionId: string): Promise<void>;
}

/**
 * Common normalized data contracts every connector must map source data
 * into (spec section "DATA NORMALIZATION") — types only in 1A; no table
 * persists these yet since no connector produces them. Every future
 * persisted row must carry provider/source id/source version/timestamps so
 * provenance is never lost (spec: "Do not write provider-specific fields
 * directly into BOQ lines without normalization and review").
 */
type SourceProvenance = {
  provider: string;
  providerSourceId: string;
  sourceVersion: string | null;
  sourceTimestamp: string | null;
  synchronizationRunId: string | null;
  reviewStatus: "PENDING" | "CONFIRMED" | "REJECTED";
};

export type ExternalProject = SourceProvenance & { name: string; description?: string };
export type ExternalFile = SourceProvenance & { name: string; mimeType: string; sizeBytes: number | null };
export type ExternalModel = SourceProvenance & { name: string; format: string };
export type ExternalVersion = SourceProvenance & { versionLabel: string; createdBy: string | null };
export type ExternalElement = SourceProvenance & { elementType: string; propertiesRef: string | null };
export type ExternalProperty = SourceProvenance & { key: string; value: string; unit: string | null };
export type ExternalDrawing = SourceProvenance & { title: string; sheetNumber: string | null };
export type ExternalMeasurement = SourceProvenance & { value: number; unit: string; sourceUnit: string; method: string };
export type ExternalQuantityCandidate = SourceProvenance & {
  description: string;
  quantity: number;
  unit: string;
  extractionMethod: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
};
