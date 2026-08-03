import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import StatusBadge, { type StatusTone } from "./status-badge";

export default function WorkspaceHeader({
  companyName,
  userName,
  userEmail,
  userRole,
  planLabel,
  planTone,
}: {
  companyName: string;
  userName: string;
  userEmail: string;
  userRole: string;
  planLabel: string;
  planTone: StatusTone;
}) {
  return (
    <header className="rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white/90 dark:bg-[#0B1426]/90 backdrop-blur-sm p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">{companyName}</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Operations Workspace</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={planLabel} tone={planTone} />
          <StatusBadge label="Systems operational" tone="success" />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4 border-t border-[#D9E2EC] dark:border-[#1E2A42] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#536078] dark:text-[#B8C4D8]">
          Signed in as <span className="font-semibold text-[#0B1630] dark:text-white">{userName || userEmail}</span>
          <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{userRole}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/projects/new"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#0EA5E9] dark:border-[#22D3EE] bg-[#0EA5E9] dark:bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-white dark:text-[#050B18] hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Project
          </Link>
          <Link
            href="/imports"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-4 py-2 text-sm font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33]"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload File
          </Link>
        </div>
      </div>
    </header>
  );
}
