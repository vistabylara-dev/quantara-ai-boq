import { AlertTriangle, FileSearch, Gauge, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CAPABILITIES: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Drawing Analysis", icon: ScanSearch },
  { label: "Cost Optimization", icon: Gauge },
  { label: "BOQ Validation", icon: FileSearch },
  { label: "Specification Review", icon: ShieldCheck },
  { label: "Risk Detection", icon: AlertTriangle },
];

export default function AIAssistantPanel() {
  return (
    <section className="rounded-[28px] border border-[#009FE3]/30 dark:border-[#21C7F3]/30 bg-gradient-to-br from-[#009FE3]/[0.04] to-transparent dark:from-[#21C7F3]/[0.06] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#009FE3]/40 bg-[#009FE3]/10 dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10">
          <Sparkles className="h-4 w-4 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#08152E] dark:text-white">AI Workspace</h2>
          <p className="mt-0.5 text-sm text-[#536078] dark:text-[#B8C4D8]">Intelligent construction analysis, reserved for an upcoming release.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CAPABILITIES.map((capability) => (
          <div
            key={capability.label}
            className="flex flex-col items-start gap-3 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-white/60 dark:bg-[#091326]/60 p-4"
          >
            <capability.icon className="h-4 w-4 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
            <p className="text-sm font-medium text-[#08152E] dark:text-white">{capability.label}</p>
            <span className="rounded-full border border-[#D5E0EC] dark:border-[#20304D] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7B879C] dark:text-[#7F8DA6]">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
