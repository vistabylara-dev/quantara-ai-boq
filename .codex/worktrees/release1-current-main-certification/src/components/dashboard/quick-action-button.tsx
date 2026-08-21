import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export default function QuickActionButton({
  href,
  label,
  icon: Icon,
  image,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional thumbnail shown in place of the plain icon — falls back to the icon when absent so
   * every button keeps working without an asset. */
  image?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] px-4 py-3 text-sm font-medium text-[#08152E] dark:text-[#F4F8FF] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#009FE3]/50 hover:bg-white hover:shadow-md dark:hover:border-[#21C7F3]/50 dark:hover:bg-[#091326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {image ? (
        <img src={image} alt="" aria-hidden="true" width={40} height={40} loading="lazy" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <Icon className="h-4 w-4 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
      )}
      {label}
    </Link>
  );
}
