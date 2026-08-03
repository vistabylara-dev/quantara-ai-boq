import { Download } from "lucide-react";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { type StatusTone } from "./status-badge";

const FILE_STATUS_TONE: Record<string, StatusTone> = {
  UPLOADED: "default",
  CLASSIFYING: "info",
  CLASSIFIED: "info",
  PREPROCESSING: "info",
  READY_FOR_PROCESSING: "info",
  PROCESSING: "info",
  NEEDS_REVIEW: "warning",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "default",
  ARCHIVED: "default",
};

export type RecentFile = {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  project: { id: string; name: string } | null;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileStatusCard({ file }: { file: RecentFile }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B9C7D6] hover:shadow-md dark:hover:border-[#31405F] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#0B1630] dark:text-white">{file.name}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {file.project?.name ?? "Unassigned project"} · {file.extension.toUpperCase()} · {formatFileSize(file.sizeBytes)}
          </p>
        </div>
        <StatusBadge label={file.status} tone={FILE_STATUS_TONE[file.status] ?? "default"} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Uploaded {formatDate(file.createdAt)}</p>
        <a
          href={`/api/files/${file.id}/download`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-1.5 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </a>
      </div>
    </div>
  );
}
