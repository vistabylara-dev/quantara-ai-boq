import { Download, Eye, FileArchive, FileBox, FileImage, FileText, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { formatStatusLabel, type StatusTone } from "@/components/dashboard/status-badge";

export type DrawingView = {
  id: string;
  originalName: string;
  extension: string;
  fileSize: number;
  status: string;
  drawingNumber: string | null;
  drawingTitle: string | null;
  revisionNumber: string | null;
  discipline: string | null;
  drawingType: string | null;
  issueDate: string | null;
  previewAvailable: boolean;
  analysisStatus: string;
  securityScanStatus: string;
  uploadedBy: { id: string; fullName: string; email: string };
  createdAt: string;
};

const STATUS_TONE: Record<string, StatusTone> = {
  UPLOADED: "success",
  FAILED: "error",
};

const EXTENSION_ICON: Record<string, LucideIcon> = {
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  tif: FileImage,
  tiff: FileImage,
  zip: FileArchive,
  dwg: FileBox,
  dxf: FileBox,
  ifc: FileBox,
  rvt: FileBox,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DrawingCard({
  drawing,
  onPreview,
  onDelete,
}: {
  drawing: DrawingView;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const Icon = EXTENSION_ICON[drawing.extension.toLowerCase()] ?? FileText;

  return (
    <div className="rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D5E0EC] bg-white dark:border-[#20304D] dark:bg-[#091326]">
            <Icon className="h-5 w-5 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#08152E] dark:text-white">{drawing.drawingTitle || drawing.originalName}</p>
            <p className="truncate text-xs text-[#7B879C] dark:text-[#8CA0BE]">{drawing.originalName}</p>
          </div>
        </div>
        <StatusBadge label={drawing.status} tone={STATUS_TONE[drawing.status] ?? "default"} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {drawing.discipline && <span className="rounded-full border border-[#D5E0EC] bg-white px-2 py-0.5 text-[10px] text-[#536078] dark:border-[#20304D] dark:bg-[#091326] dark:text-[#8CA0BE]">{formatStatusLabel(drawing.discipline)}</span>}
        {drawing.drawingType && <span className="rounded-full border border-[#D5E0EC] bg-white px-2 py-0.5 text-[10px] text-[#536078] dark:border-[#20304D] dark:bg-[#091326] dark:text-[#8CA0BE]">{formatStatusLabel(drawing.drawingType)}</span>}
        {drawing.revisionNumber && <span className="rounded-full border border-[#D5E0EC] bg-white px-2 py-0.5 text-[10px] text-[#536078] dark:border-[#20304D] dark:bg-[#091326] dark:text-[#8CA0BE]">Rev {drawing.revisionNumber}</span>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#536078] dark:text-[#8CA0BE]">
        {drawing.drawingNumber && (
          <div className="col-span-2">
            <dt className="inline text-[#7B879C] dark:text-[#7F8DA6]">No. </dt>
            <dd className="inline">{drawing.drawingNumber}</dd>
          </div>
        )}
        <div>
          <dt className="inline text-[#7B879C] dark:text-[#7F8DA6]">Size </dt>
          <dd className="inline">{formatFileSize(drawing.fileSize)}</dd>
        </div>
        {drawing.issueDate && (
          <div>
            <dt className="inline text-[#7B879C] dark:text-[#7F8DA6]">Issued </dt>
            <dd className="inline">{drawing.issueDate}</dd>
          </div>
        )}
      </dl>

      <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-[#7B879C] dark:text-[#7F8DA6]">
        {drawing.previewAvailable ? "Preview available" : "Preview not available"} · AI analysis: {formatStatusLabel(drawing.analysisStatus)}
      </p>
      <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">
        Uploaded {formatDate(drawing.createdAt)} by {drawing.uploadedBy.fullName}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5E0EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#08152E] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#091326] dark:text-[#F4F8FF] dark:hover:bg-[#101D34]"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {drawing.previewAvailable ? "Preview" : "Details"}
        </button>
        <a
          href={`/api/files/${drawing.id}/download`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5E0EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#08152E] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#091326] dark:text-[#F4F8FF] dark:hover:bg-[#101D34]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </a>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  );
}
