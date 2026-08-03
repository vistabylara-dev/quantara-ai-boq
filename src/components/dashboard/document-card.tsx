import { Download } from "lucide-react";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { type StatusTone } from "./status-badge";

const DOCUMENT_STATUS_TONE: Record<string, StatusTone> = {
  QUEUED: "default",
  GENERATING: "info",
  COMPLETED: "success",
  FAILED: "error",
};

export type RecentDocument = {
  id: string;
  format: string;
  status: string;
  revisionNumber: number;
  generatedByName: string;
  createdAt: string;
  completedAt: string | null;
  project: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
};

export default function DocumentCard({ document }: { document: RecentDocument }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-colors hover:border-[#B9C7D6] dark:hover:border-[#31405F]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#0B1630] dark:text-white">{document.project?.name ?? "Unassigned project"}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {document.template?.name ?? "No template applied"} · Revision {document.revisionNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={document.format} tone="default" />
          <StatusBadge label={document.status} tone={DOCUMENT_STATUS_TONE[document.status] ?? "default"} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
          Generated {formatDate(document.createdAt)} by {document.generatedByName}
        </p>
        {document.status === "COMPLETED" ? (
          <a
            href={`/api/documents/${document.id}/download`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-1.5 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </a>
        ) : (
          <span className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Not yet available</span>
        )}
      </div>
    </div>
  );
}
