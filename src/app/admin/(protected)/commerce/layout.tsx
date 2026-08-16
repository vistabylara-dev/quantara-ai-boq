import Link from "next/link";
import type { ReactNode } from "react";

const tabClass =
  "inline-flex min-h-10 items-center rounded-xl border border-[#D9E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]";

export default function CommerceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <nav
        aria-label="Commerce administration"
        className="flex flex-wrap gap-2 rounded-[22px] border border-[#D9E2EC] bg-[#F7FAFC] p-3 dark:border-[#1E2A42] dark:bg-[#081120]"
      >
        <Link href="/admin/commerce/products" className={tabClass}>Products</Link>
        <Link href="/admin/commerce" className={tabClass}>Commerce Centre</Link>
        <Link href="/admin/commerce/refunds" className={tabClass}>Refunds</Link>
      </nav>
      {children}
    </div>
  );
}