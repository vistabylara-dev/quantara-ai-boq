export type StatusTone = "success" | "warning" | "error" | "info" | "default";

const toneClasses: Record<StatusTone, string> = {
  success: "border-[#159A6A]/30 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
  warning: "border-[#D98A16]/30 bg-[#D98A16]/10 text-[#D98A16] dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  error: "border-[#D84A4A]/30 bg-[#D84A4A]/10 text-[#D84A4A] dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
  info: "border-[#0EA5E9]/30 bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE]/30 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]",
  default: "border-[#D9E2EC] bg-[#EEF3F8] text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#B8C4D8]",
};

export function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function StatusBadge({ label, tone = "default" }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {formatStatusLabel(label)}
    </span>
  );
}
