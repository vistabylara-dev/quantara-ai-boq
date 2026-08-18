"use client";

import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";

export type StatusTone = "success" | "warning" | "error" | "info" | "default";

const toneClasses: Record<StatusTone, string> = {
  success: "border-[#159A6A]/30 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  warning: "border-[#D98A16]/30 bg-[#D98A16]/10 text-[#D98A16] dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  error: "border-[#D84A4A]/30 bg-[#D84A4A]/10 text-[#D84A4A] dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
  info: "border-[#009FE3]/30 bg-[#009FE3]/10 text-[#0077B6] dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]",
  default: "border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#B8C4D8]",
};

export function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Every raw status enum value that this badge is known to render across the app (Project, BOQ,
 * Document and File statuses, plus the "Locked" literal) — covers the full set defined in the
 * dashboard's own PROJECT_STATUS_TONE / BOQ_STATUS_TONE / DOCUMENT_STATUS_TONE / FILE_STATUS_TONE
 * maps. Anything not in this map (e.g. a raw file format like "PDF", or a status value owned by a
 * page outside src/components/dashboard) safely falls back to the existing formatStatusLabel
 * transform below — unchanged, untranslated behavior, never a blank or broken badge.
 */
const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: "dashboardComponents.status.draft",
  CALCULATED: "dashboardComponents.status.calculated",
  NEEDS_VERIFICATION: "dashboardComponents.status.needsVerification",
  LOCKED: "dashboardComponents.status.locked",
  ISSUED: "dashboardComponents.status.issued",
  APPROVED: "dashboardComponents.status.approved",
  QUEUED: "dashboardComponents.status.queued",
  GENERATING: "dashboardComponents.status.generating",
  COMPLETED: "dashboardComponents.status.completed",
  FAILED: "dashboardComponents.status.failed",
  UPLOADED: "dashboardComponents.status.uploaded",
  CLASSIFYING: "dashboardComponents.status.classifying",
  CLASSIFIED: "dashboardComponents.status.classified",
  PREPROCESSING: "dashboardComponents.status.preprocessing",
  READY_FOR_PROCESSING: "dashboardComponents.status.readyForProcessing",
  PROCESSING: "dashboardComponents.status.processing",
  NEEDS_REVIEW: "dashboardComponents.status.needsReview",
  CANCELLED: "dashboardComponents.status.cancelled",
  ARCHIVED: "dashboardComponents.status.archived",
  ACTIVE: "dashboardComponents.status.active",
  INTERNALLY_APPROVED: "dashboardComponents.status.internallyApproved",
  SENT: "dashboardComponents.status.sent",
  CLIENT_APPROVED: "dashboardComponents.status.clientApproved",
  REVISION_REQUESTED: "dashboardComponents.status.revisionRequested",
  REJECTED: "dashboardComponents.status.rejected",
};

export default function StatusBadge({ label, tone = "default" }: { label: string; tone?: StatusTone }) {
  const t = useTranslations();
  const translationKey = STATUS_LABEL_KEYS[label.toUpperCase()];
  const displayLabel = translationKey ? t(translationKey) : formatStatusLabel(label);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {displayLabel}
    </span>
  );
}
