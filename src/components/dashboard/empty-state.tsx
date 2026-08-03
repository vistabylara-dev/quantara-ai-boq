import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[#D9E2EC] dark:border-[#1E2A42] px-6 py-10 text-center">
      {Icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33]">
          <Icon className="h-5 w-5 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
        </span>
      )}
      {title && <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{title}</p>}
      <p className="mt-1 max-w-sm text-sm text-[#7B879C] dark:text-[#7F8DA6]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
