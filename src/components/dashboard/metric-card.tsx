import type { LucideIcon } from "lucide-react";

export type MetricTone = "default" | "warning" | "error";

const toneIconClasses: Record<MetricTone, string> = {
  default: "text-[#0077B6] dark:text-[#21C7F3]",
  warning: "text-[#D98A16] dark:text-[#FBBF24]",
  error: "text-[#D84A4A] dark:text-[#F87171]",
};

const toneBadgeClasses: Record<MetricTone, string> = {
  default: "border-[#009FE3]/30 bg-[#009FE3]/10 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/10",
  warning: "border-[#D98A16]/30 bg-[#D98A16]/10 dark:border-[#FBBF24]/30 dark:bg-[#FBBF24]/10",
  error: "border-[#D84A4A]/30 bg-[#D84A4A]/10 dark:border-[#F87171]/30 dark:bg-[#F87171]/10",
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
      <div className="group relative overflow-hidden rounded-3xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 transition-shadow hover:shadow-[0_0_0_1px_rgba(0,159,227,0.25)] dark:hover:shadow-[0_0_0_1px_rgba(33,199,243,0.25)]">
        <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#009FE3]/10 dark:bg-[#21C7F3]/10" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{label}</p>
          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneBadgeClasses[tone]}`}>
            <Icon className={`h-5 w-5 ${toneIconClasses[tone]}`} aria-hidden="true" />
          </span>
        </div>
        <p className="relative mt-4 text-4xl font-semibold text-[#08152E] dark:text-white">{value.toLocaleString()}</p>
        {support && <p className="relative mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">{support}</p>}
      </div>
    );
  }

  return (
    <div className="group rounded-3xl border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-5 transition-shadow hover:shadow-[0_0_0_1px_rgba(0,159,227,0.25)] dark:hover:shadow-[0_0_0_1px_rgba(33,199,243,0.25)]">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#8CA0BE]">{label}</p>
        <Icon className={`h-4 w-4 ${toneIconClasses[tone]}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-[#08152E] dark:text-white">{value.toLocaleString()}</p>
      {support && <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">{support}</p>}
    </div>
  );
}
