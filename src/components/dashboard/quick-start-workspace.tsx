"use client";

import { ArrowRight, FileCheck2, FileOutput, FolderPlus, Send, Upload } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslateFn, TranslationKey } from "@/lib/i18n/translate";
import SectionHeader from "./section-header";

type QuickStartStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Optional thumbnail shown above the step number/icon row. Not every step has one yet — cards
   * without an image fall back to the plain icon-only layout so a missing asset never breaks the
   * row. */
  image?: string;
};

// Static assets under public/images/dashboard, kept under their original uploaded filenames.
const IMG = {
  uploadDrawings: `/images/dashboard/${encodeURIComponent("Gemini_Generated_Image_wru8qiwru8qiwru8.png")}`,
  createBoq: `/images/dashboard/${encodeURIComponent("Gemini_Generated_Image_cpo7rcpo7rcpo7rc.png")}`,
  generateProposal: `/images/dashboard/${encodeURIComponent("Gemini_Generated_Image_afy5jiafy5jiafy5.png")}`,
};

/**
 * Pure step-list builder, kept separate from the component so the hrefs can be unit-tested
 * without rendering React. "Upload Drawings" must always land on the purpose-built drawing
 * uploader (/projects/{id}/drawings) — it must never resolve to /imports (the CSV/XLSX
 * spreadsheet importer) or to the legacy /files extraction-preview page. See
 * tests/quick-start-workspace-navigation.test.ts, added after a production PDF upload was
 * misrouted through /imports because this card pointed there when no project was selected yet.
 */
export function buildQuickStartSteps(currentProjectId: string | null): QuickStartStep[] {
  return [
    {
      step: 1,
      title: "Create Project",
      description: "Set up a new client project workspace.",
      href: "/projects/new",
      icon: FolderPlus,
    },
    {
      step: 2,
      title: "Upload Drawings",
      description: "Add drawings and source files for your project.",
      href: currentProjectId ? `/projects/${currentProjectId}/drawings` : "/projects/new",
      icon: Upload,
      image: IMG.uploadDrawings,
    },
    {
      step: 3,
      title: "Create BOQ",
      description: "Build a bill of quantities from your data.",
      href: currentProjectId ? `/projects/${currentProjectId}/boq` : "/projects/new",
      icon: FileCheck2,
      image: IMG.createBoq,
    },
    {
      step: 4,
      title: "Generate Proposal",
      description: "Package a proposal for client review.",
      href: currentProjectId ? `/projects/${currentProjectId}/proposals` : "/projects",
      icon: Send,
      image: IMG.generateProposal,
    },
    {
      step: 5,
      title: "Export Documents",
      description: "Produce final, client-ready documents.",
      href: currentProjectId ? `/projects/${currentProjectId}/documents` : "/projects",
      icon: FileOutput,
    },
  ];
}

/**
 * `buildQuickStartSteps`'s `title` stays a stable English identifier — it's matched literally
 * by tests/quick-start-workspace-navigation.test.ts (step.title === "Upload Drawings"), so it
 * cannot become a locale-dependent value. The visible, translated text is looked up here by
 * that stable identifier instead of being read directly off the step.
 */
const STEP_TRANSLATION_KEYS: Record<string, { title: TranslationKey; description: TranslationKey }> = {
  "Create Project": { title: "dashboardComponents.quickStartWorkspace.createProjectTitle", description: "dashboardComponents.quickStartWorkspace.createProjectDescription" },
  "Upload Drawings": { title: "dashboardComponents.quickStartWorkspace.uploadDrawingsTitle", description: "dashboardComponents.quickStartWorkspace.uploadDrawingsDescription" },
  "Create BOQ": { title: "dashboardComponents.quickStartWorkspace.createBoqTitle", description: "dashboardComponents.quickStartWorkspace.createBoqDescription" },
  "Generate Proposal": { title: "dashboardComponents.quickStartWorkspace.generateProposalTitle", description: "dashboardComponents.quickStartWorkspace.generateProposalDescription" },
  "Export Documents": { title: "dashboardComponents.quickStartWorkspace.exportDocumentsTitle", description: "dashboardComponents.quickStartWorkspace.exportDocumentsDescription" },
};

function translateStep(step: QuickStartStep, t: TranslateFn): { title: string; description: string } {
  const keys = STEP_TRANSLATION_KEYS[step.title];
  if (!keys) return { title: step.title, description: step.description };
  return { title: t(keys.title), description: t(keys.description) };
}

export default function QuickStartWorkspace({ currentProjectId }: { currentProjectId: string | null }) {
  const t = useTranslations();
  const steps: QuickStartStep[] = buildQuickStartSteps(currentProjectId);

  return (
    <section className="rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8">
      <SectionHeader
        title={t("dashboardComponents.quickStartWorkspace.title")}
        description={t("dashboardComponents.quickStartWorkspace.subtitle")}
      />
      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {steps.map((item, index) => {
          const translated = translateStep(item, t);
          return (
            <div key={item.step} className="flex items-center gap-3 lg:contents">
              <Link
                href={item.href}
                className="group flex flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] transition-all duration-200 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-lg dark:hover:border-[#21C7F3]/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    width={900}
                    height={448}
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                )}
                <div className={`flex flex-1 flex-col gap-3 p-5 ${item.image ? "pt-3" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#009FE3]/40 bg-[#009FE3]/10 text-xs font-semibold text-[#0077B6] dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3]">
                      {item.step}
                    </span>
                    <item.icon className="h-4 w-4 text-[#7B879C] transition-colors group-hover:text-[#0077B6] dark:text-[#7F8DA6] dark:group-hover:text-[#21C7F3]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#08152E] dark:text-white">{translated.title}</p>
                    <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">{translated.description}</p>
                  </div>
                </div>
              </Link>
              {index < steps.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#B9C7D6] dark:text-[#31405F] lg:block" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
