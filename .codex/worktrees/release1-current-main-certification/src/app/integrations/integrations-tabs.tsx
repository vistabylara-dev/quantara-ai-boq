"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/integrations", label: "Marketplace" },
  { href: "/integrations/connections", label: "Connected Accounts" },
  { href: "/integrations/history", label: "History" },
];

export default function IntegrationsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Integrations sections" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE] dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]"
                : "border-[#D9E2EC] bg-white text-[#536078] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#8CA0BE] dark:hover:bg-[#111D33]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
