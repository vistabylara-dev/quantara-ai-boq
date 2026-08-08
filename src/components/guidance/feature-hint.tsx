import { Sparkles } from "lucide-react";
import Link from "next/link";

export type FeatureAvailability = "AVAILABLE" | "ENTITLEMENT_REQUIRED" | "COMING_SOON";

export type FeatureHintAction = {
  label: string;
  href: string;
};

export type FeatureHintDefinition = {
  id: "GOOGLE_DRIVE_SOURCES" | "GOVERNED_CATALOGUE" | "MANUAL_MEASUREMENTS" | "VISIBLE_QUANTITY_EQUATIONS" | "VOICE_GUIDANCE";
  title: string;
  description: string;
  availability: FeatureAvailability;
  cta?: FeatureHintAction;
};

export const FEATURE_HINT_REGISTRY = {
  GOOGLE_DRIVE_SOURCES: {
    id: "GOOGLE_DRIVE_SOURCES",
    title: "Google Drive project sources",
    description: "Import supported project sources from Google Drive into the selected Quantara project.",
    availability: "AVAILABLE",
    cta: { label: "Open Google Drive", href: "/integrations/google-drive/connect" },
  },
  GOVERNED_CATALOGUE: {
    id: "GOVERNED_CATALOGUE",
    title: "Governed catalogue information",
    description: "Use governed catalogue information when preparing professional BOQ items.",
    availability: "AVAILABLE",
    cta: { label: "Open Catalogue", href: "/catalogue" },
  },
  MANUAL_MEASUREMENTS: {
    id: "MANUAL_MEASUREMENTS",
    title: "Manual measurement entry",
    description: "Enter missing required values manually for supported deterministic measurement types before calculation.",
    availability: "AVAILABLE",
  },
  VISIBLE_QUANTITY_EQUATIONS: {
    id: "VISIBLE_QUANTITY_EQUATIONS",
    title: "Visible quantity equations",
    description: "Review the equation, inputs, deductions or allowances, and calculated result before professional confirmation.",
    availability: "AVAILABLE",
  },
  VOICE_GUIDANCE: {
    id: "VOICE_GUIDANCE",
    title: "Voice guidance",
    description: "Voice guidance is not available in the verified product yet.",
    availability: "COMING_SOON",
  },
} as const satisfies Record<FeatureHintDefinition["id"], FeatureHintDefinition>;

export type FeatureHintProps = {
  title: string;
  description: string;
  availability: FeatureAvailability;
  cta?: FeatureHintAction;
  className?: string;
};

const availabilityPresentation: Record<FeatureAvailability, { label: string; classes: string }> = {
  AVAILABLE: {
    label: "Available",
    classes: "border-[#159A6A]/30 bg-[#159A6A]/10 text-[#0A6848] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  ENTITLEMENT_REQUIRED: {
    label: "Entitlement required",
    classes: "border-[#D98A16]/30 bg-[#D98A16]/10 text-[#7A3F00] dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  },
  COMING_SOON: {
    label: "Coming soon",
    classes: "border-[#D5E0EC] bg-[#EAF1F8] text-[#536078] dark:border-[#20304D] dark:bg-[#101D34] dark:text-[#8CA0BE]",
  },
};

export function FeatureHint({
  title,
  description,
  availability,
  cta,
  className = "",
}: FeatureHintProps) {
  const presentation = availabilityPresentation[availability];
  const availableAction = availability === "AVAILABLE" ? cta : undefined;

  return (
    <aside
      className={`rounded-2xl border border-[#009FE3]/25 bg-white p-4 text-[#08152E] shadow-sm dark:border-[#21C7F3]/25 dark:bg-[#101D34] dark:text-white ${className}`.trim()}
      aria-label={`Feature hint: ${title}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#009FE3]/30 bg-[#009FE3]/10 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10">
          <Sparkles className="h-4 w-4 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#08152E] dark:text-white">{title}</p>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${presentation.classes}`}>
              {presentation.label}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-[#536078] dark:text-[#B8C4D8]">{description}</p>
          {availableAction ? (
            <Link
              href={availableAction.href}
              className="mt-3 inline-flex min-h-9 items-center rounded-xl border border-[#009FE3] px-3 py-1.5 text-xs font-semibold text-[#0077B6] transition hover:bg-[#009FE3]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] dark:border-[#21C7F3] dark:text-[#21C7F3] dark:hover:bg-[#21C7F3]/10 dark:focus-visible:outline-[#21C7F3]"
            >
              {availableAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default FeatureHint;
