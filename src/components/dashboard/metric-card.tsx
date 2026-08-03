import type { LucideIcon } from "lucide-react";

export type MetricTone = "default" | "warning" | "error";

const toneIconClasses: Record<MetricTone, string> = {
  default: "text-[#0284C7] dark:text-[#22D3EE]",
  warning: "text-[#D98A16] dark:text-[#FBBF24]",
  error: "text-[#D84A4A] dark:text-[#F87171]",
};

export default function MetricCard({
  icon: Icon,
  label,
  value,
  support,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  support?: string;
  tone?: MetricTone;
}) {
  return (
    <div className="group rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-5 transition-shadow hover:shadow-[0_0_0_1px_rgba(14,165,233,0.25)] dark:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25)]">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{label}</p>
        <Icon className={`h-4 w-4 ${toneIconClasses[tone]}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-[#0B1630] dark:text-white">{value.toLocaleString()}</p>
      {support && <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{support}</p>}
    </div>
  );
}
