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
      className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] px-4 py-3 text-sm font-medium text-[#08152E] dark:text-[#F4F8FF] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#009FE3]/50 hover:bg-white hover:shadow-md dark:hover:border-[#21C7F3]/50 dark:hover:bg-[#091326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Icon className="h-4 w-4 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
      {label}
    </Link>
  );
}
