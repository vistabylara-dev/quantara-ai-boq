import Link from "next/link";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { type StatusTone } from "./status-badge";

const PROJECT_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "default",
  ACTIVE: "success",
  NEEDS_REVIEW: "warning",
  INTERNALLY_APPROVED: "info",
  SENT: "info",
  CLIENT_APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "error",
  ARCHIVED: "default",
};

const STATUS_PROGRESS_ORDER = ["DRAFT", "ACTIVE", "NEEDS_REVIEW", "INTERNALLY_APPROVED", "SENT", "CLIENT_APPROVED", "ARCHIVED"];

function statusProgress(status: string): { fraction: number; barClass: string } {
  if (status === "REVISION_REQUESTED") {
    return { fraction: 2 / (STATUS_PROGRESS_ORDER.length - 1), barClass: "bg-[#D98A16] dark:bg-[#FBBF24]" };
  }
  if (status === "REJECTED") {
    return { fraction: 4 / (STATUS_PROGRESS_ORDER.length - 1), barClass: "bg-[#D84A4A] dark:bg-[#F87171]" };
  }
  const index = STATUS_PROGRESS_ORDER.indexOf(status);
  const fraction = index === -1 ? 0 : index / (STATUS_PROGRESS_ORDER.length - 1);
  const barClass = status === "ARCHIVED" ? "bg-[#159A6A] dark:bg-emerald-400" : "bg-[#0EA5E9] dark:bg-[#22D3EE]";
  return { fraction, barClass };
}

export type RecentProject = {
  id: string;
  name: string;
  reference: string;
  status: string;
  updatedAt: string;
  client: { id: string; name: string; companyName: string | null } | null;
  boqCount: number;
  fileCount: number;
  documentCount: number;
};

export default function ProjectCard({ project }: { project: RecentProject }) {
  const progress = statusProgress(project.status);
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B9C7D6] hover:shadow-md dark:hover:border-[#31405F] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#0B1630] dark:text-white">{project.name}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {project.client?.companyName || project.client?.name || "No client assigned"}
          </p>
        </div>
        <StatusBadge label={project.status} tone={PROJECT_STATUS_TONE[project.status] ?? "default"} />
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#D9E2EC] dark:bg-[#1E2A42]"
        role="img"
        aria-label={`Project lifecycle progress: ${Math.round(progress.fraction * 100)}%`}
      >
        <span className={`block h-full rounded-full ${progress.barClass}`} style={{ width: `${Math.max(6, progress.fraction * 100)}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#536078] dark:text-[#B8C4D8]">
        <span>{project.boqCount} BOQ{project.boqCount === 1 ? "" : "s"}</span>
        <span>{project.fileCount} file{project.fileCount === 1 ? "" : "s"}</span>
        <span>{project.documentCount} document{project.documentCount === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Updated {formatDate(project.updatedAt)}</p>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-1.5 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33]"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
