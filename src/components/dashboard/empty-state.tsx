import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import EmptyStateIllustration from "@/components/visuals/empty-state-illustration";

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
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-[#D5E0EC] dark:border-[#20304D] px-6 py-10 text-center">
      <div className="relative mb-3 h-20 w-32 text-[#0077B6] dark:text-[#21C7F3]">
        <EmptyStateIllustration className="h-full w-full" />
        {Icon && (
          <span className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-xl border border-[#D5E0EC] bg-white dark:border-[#20304D] dark:bg-[#091326]">
            <Icon className="h-4 w-4 text-[#536078] dark:text-[#9FB3CE]" aria-hidden="true" />
          </span>
        )}
      </div>
      {title && <p className="text-sm font-semibold text-[#08152E] dark:text-white">{title}</p>}
      <p className="mt-1 max-w-sm text-sm text-[#7B879C] dark:text-[#8CA0BE]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
