import { ArrowRight, FileCheck2, FileOutput, FolderPlus, Send, Upload } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import SectionHeader from "./section-header";

type QuickStartStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export default function QuickStartWorkspace({ currentProjectId }: { currentProjectId: string | null }) {
  const steps: QuickStartStep[] = [
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
      description: "Add drawings and source files for extraction.",
      href: currentProjectId ? `/projects/${currentProjectId}/files` : "/imports",
      icon: Upload,
    },
    {
      step: 3,
      title: "Create BOQ",
      description: "Build a bill of quantities from your data.",
      href: currentProjectId ? `/projects/${currentProjectId}/boq` : "/projects/new",
      icon: FileCheck2,
    },
    {
      step: 4,
      title: "Generate Proposal",
      description: "Package a proposal for client review.",
      href: currentProjectId ? `/projects/${currentProjectId}/proposals` : "/projects",
      icon: Send,
    },
    {
      step: 5,
      title: "Export Documents",
      description: "Produce final, client-ready documents.",
      href: currentProjectId ? `/projects/${currentProjectId}/documents` : "/projects",
      icon: FileOutput,
    },
  ];

  return (
    <section className="rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8">
      <SectionHeader title="Quick start workspace" description="The path from raw drawings to a delivered proposal." />
      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        {steps.map((item, index) => (
          <div key={item.step} className="flex items-center gap-3 lg:contents">
            <Link
              href={item.href}
              className="group flex flex-1 flex-col gap-3 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#0EA5E9]/50 hover:shadow-lg dark:hover:border-[#22D3EE]/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 text-xs font-semibold text-[#0284C7] dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]">
                  {item.step}
                </span>
                <item.icon className="h-4 w-4 text-[#7B879C] transition-colors group-hover:text-[#0284C7] dark:text-[#7F8DA6] dark:group-hover:text-[#22D3EE]" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-[#0B1630] dark:text-white">{item.title}</p>
                <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">{item.description}</p>
              </div>
            </Link>
            {index < steps.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#B9C7D6] dark:text-[#31405F] lg:block" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
