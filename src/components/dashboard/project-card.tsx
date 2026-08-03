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
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-colors hover:border-[#B9C7D6] dark:hover:border-[#31405F]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#0B1630] dark:text-white">{project.name}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            {project.client?.companyName || project.client?.name || "No client assigned"}
          </p>
        </div>
        <StatusBadge label={project.status} tone={PROJECT_STATUS_TONE[project.status] ?? "default"} />
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
