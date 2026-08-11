import {
  validateTechnicalReportShareAccess,
  type TechnicalReportShareDenialReason,
} from "@/lib/documents/technical-report-share";
import { createStorageAdapter, resolveStorageProvider } from "@/lib/storage/storage-factory";
import type { DocumentStorageAdapter } from "@/lib/storage/document-storage-adapter";
import { AppError } from "@/lib/errors/app-error";

/** Was hardcoded to the local-filesystem adapter — see technical-report-service.ts for the same production fix; the file this reads was written through that same "generated-documents" storage namespace. */
let cachedDocumentStorageAdapter: DocumentStorageAdapter | null = null;
function getDocumentStorageAdapter(): DocumentStorageAdapter {
  if (!cachedDocumentStorageAdapter) {
    cachedDocumentStorageAdapter = createStorageAdapter({ provider: resolveStorageProvider(), purpose: "generated-documents" });
  }
  return cachedDocumentStorageAdapter;
}

export type PublicTechnicalReportViewResult =
  | {
      ok: true;
      reportName: string;
      projectName: string;
      companyName: string;
      fileName: string | null;
      completedAt: string | null;
    }
  | { ok: false; reason: TechnicalReportShareDenialReason };

/** No actor, no RBAC — token validity is the only gate, matching the equivalent proposal flow.
 *  Never exposes storageKey, checksum, or any internal id beyond what the download route needs. */
export async function getPublicTechnicalReportView(rawToken: string): Promise<PublicTechnicalReportViewResult> {
  const result = await validateTechnicalReportShareAccess(rawToken);
  if (!result.ok) return result;
  const { report } = result;
  return {
    ok: true,
    reportName: report.name,
    projectName: report.project.name,
    companyName: report.company.tradeName || report.company.legalName,
    fileName: report.fileName,
    completedAt: report.completedAt?.toISOString() ?? null,
  };
}

/** The only path a client reads generated-technical-report bytes through without a session —
 *  mirrors downloadProposalDocument: token validity is checked before the storage adapter is
 *  ever touched. */
export async function downloadPublicTechnicalReport(rawToken: string) {
  const result = await validateTechnicalReportShareAccess(rawToken);
  if (!result.ok) {
    throw new AppError(`TECHNICAL_REPORT_SHARE_${result.reason}`, "This report link is not valid.", result.reason === "NOT_FOUND" ? 404 : 410);
  }
  const { report } = result;
  if (!report.storageKey) {
    throw new AppError("TECHNICAL_REPORT_SHARE_NOT_READY", "This report is not ready for download yet.", 409);
  }
  const buffer = await getDocumentStorageAdapter().getObject(report.storageKey);
  return {
    buffer,
    fileName: report.fileName ?? `${report.name}.docx`,
    mimeType: report.mimeType ?? "application/octet-stream",
  };
}
