import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export default function QuickActionButton({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-4 py-3 text-sm font-medium text-[#0B1630] dark:text-[#F7FAFC] transition-colors hover:border-[#0EA5E9]/50 dark:hover:border-[#22D3EE]/50 hover:bg-white dark:hover:bg-[#0B1426] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
    >
      <Icon className="h-4 w-4 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
      {label}
    </Link>
  );
}
