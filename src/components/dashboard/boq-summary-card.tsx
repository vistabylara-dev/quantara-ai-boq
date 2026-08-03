import Link from "next/link";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { type StatusTone } from "./status-badge";

const BOQ_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "default",
  CALCULATED: "info",
  NEEDS_VERIFICATION: "warning",
  LOCKED: "info",
  ISSUED: "success",
  APPROVED: "success",
};

export type RecentBoq = {
  id: string;
  title: string;
  status: string;
  isLocked: boolean;
  revisionNumber: number;
  itemCount: number;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  project: { id: string; name: string; currency: string } | null;
  updatedAt: string;
};

export default function BOQSummaryCard({ boq }: { boq: RecentBoq }) {
  const currency = boq.project?.currency ?? "AED";
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-colors hover:border-[#B9C7D6] dark:hover:border-[#31405F]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[#0B1630] dark:text-white">{boq.title}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{boq.project?.name ?? "Unassigned project"}</p>
        </div>
        <div className="flex items-center gap-2">
          {boq.isLocked && <StatusBadge label="Locked" tone="info" />}
          <StatusBadge label={boq.status} tone={BOQ_STATUS_TONE[boq.status] ?? "default"} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">Items</p>
          <p className="mt-1 font-semibold text-[#0B1630] dark:text-white">{boq.itemCount}</p>
        </div>
        <div>
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">Subtotal</p>
          <p className="mt-1 font-semibold text-[#0B1630] dark:text-white">{formatCurrency(boq.subtotal, currency)}</p>
        </div>
        <div>
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">VAT</p>
          <p className="mt-1 font-semibold text-[#0B1630] dark:text-white">{formatCurrency(boq.vatAmount, currency)}</p>
        </div>
        <div>
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">Grand total</p>
          <p className="mt-1 font-semibold text-[#0B1630] dark:text-white">{formatCurrency(boq.grandTotal, currency)}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Revision {boq.revisionNumber} · Updated {formatDate(boq.updatedAt)}</p>
        {boq.project && (
          <Link
            href={`/projects/${boq.project.id}/boq`}
            className="rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-1.5 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33]"
          >
            Open
          </Link>
        )}
      </div>
    </div>
  );
}
