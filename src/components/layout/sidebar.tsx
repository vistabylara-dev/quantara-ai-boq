"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAVIGATION_ITEMS } from "./navigation-items";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden xl:flex xl:flex-col xl:gap-6 xl:border-r xl:border-[#D9E2EC] dark:xl:border-[#1E2A42] xl:py-8 bg-white dark:bg-[#0B1426] text-[#0B1630] dark:text-[#F7FAFC] transition-[width] ${
        collapsed ? "xl:w-20 xl:px-3" : "xl:w-72 xl:px-6"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {!collapsed && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#7F8DA6]">Workspace</p>
            <h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">Quantara AI</h2>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={collapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] text-[#536078] dark:text-[#7F8DA6] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-2" aria-label="Primary">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE] ${
                isActive
                  ? "border-[#0EA5E9]/40 bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]"
                  : "border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] text-[#0B1630] dark:text-[#F7FAFC] hover:border-[#B9C7D6] dark:hover:border-[#31405F]"
              }`}
            >
              {collapsed ? item.label.slice(0, 1) : item.label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-4 text-sm text-[#536078] dark:text-[#7F8DA6]">
          <p className="text-[#0B1630] dark:text-slate-200">Compact enterprise navigation.</p>
          <p className="mt-3 text-xs leading-5">Use the menu button to reach these sections on smaller screens.</p>
        </div>
      )}
    </aside>
  );
}
