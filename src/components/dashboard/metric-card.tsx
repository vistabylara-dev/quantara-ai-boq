import type { LucideIcon } from "lucide-react";

export type MetricTone = "default" | "warning" | "error";

const toneIconClasses: Record<MetricTone, string> = {
  default: "text-[#00F0FF]",
  warning: "text-[#FBBF24]",
  error: "text-[#FF0055]",
};

const toneBadgeClasses: Record<MetricTone, string> = {
  default: "border-[#00F0FF]/30 bg-[#00F0FF]/10",
  warning: "border-[#FBBF24]/30 bg-[#FBBF24]/10",
  error: "border-[#FF0055]/30 bg-[#FF0055]/10",
};

export default function MetricCard({
  icon: Icon,
  label,
  value,
  support,
  tone = "default",
  variant = "compact",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  support?: string;
  tone?: MetricTone;
  variant?: "primary" | "compact";
}) {
  if (variant === "primary") {
    return (
      <div className="group relative overflow-hidden cyber-panel cyber-border p-6 transition-all hover:border-[#00F0FF]/50 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)] rounded-sm">
        <span className="absolute -end-6 -top-6 h-24 w-24 rounded-full bg-[#00F0FF]/10 group-hover:bg-[#00F0FF]/20 transition-colors blur-xl" aria-hidden="true" />
        <div className="relative flex items-center justify-between border-b border-white/5 pb-4 mb-4">
          <p className="terminal-text text-[10px] uppercase tracking-[0.3em] text-[#00F0FF]">{label}</p>
          <span className={`flex h-10 w-10 items-center justify-center rounded-sm border ${toneBadgeClasses[tone]}`}>
            <Icon className={`h-5 w-5 ${toneIconClasses[tone]}`} aria-hidden="true" />
          </span>
        </div>
        <p className="relative text-4xl font-bold text-white tracking-widest">{value.toLocaleString()}</p>
        {support && <p className="relative mt-2 terminal-text text-[9px] uppercase tracking-widest text-slate-500">{support}</p>}
      </div>
    );
  }

  return (
    <div className="group overflow-hidden cyber-panel cyber-border p-5 transition-all hover:border-[#00F0FF]/50 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)] rounded-sm">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
        <p className="terminal-text text-[9px] uppercase tracking-[0.3em] text-slate-400 group-hover:text-[#00F0FF] transition-colors">{label}</p>
        <Icon className={`h-4 w-4 ${toneIconClasses[tone]}`} aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-white tracking-wider">{value.toLocaleString()}</p>
      {support && <p className="mt-2 terminal-text text-[9px] uppercase tracking-widest text-slate-500">{support}</p>}
    </div>
  );
}
