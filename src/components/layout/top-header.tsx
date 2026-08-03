"use client";

import { Bell, Menu, Search } from "lucide-react";
import UserMenu from "./user-menu";

type TopHeaderProps = {
  onMenuClick: () => void;
};

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-4 py-4 sm:px-6 xl:px-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[#7B879C] dark:text-[#7F8DA6]">Quantara AI</p>
          <h1 className="text-xl font-semibold text-[#0B1630] dark:text-white sm:text-2xl">Quantity Intelligence Workspace</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#B8C4D8] hover:bg-white dark:hover:bg-[#0B1426] xl:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] text-[#536078] dark:text-[#B8C4D8] hover:bg-white dark:hover:bg-[#0B1426] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <UserMenu />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <label className="group relative block">
          <span className="sr-only">Search workspace</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search projects, BOQs, clients"
            className="w-full rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] px-12 py-3 text-sm text-[#0B1630] dark:text-white outline-none transition-colors placeholder:text-[#7B879C] dark:placeholder:text-[#7F8DA6] focus:border-[#0EA5E9] dark:focus:border-[#22D3EE] focus:ring-2 focus:ring-[#0EA5E9]/20 dark:focus:ring-[#22D3EE]/20"
          />
        </label>
        <div className="rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-4 text-sm text-[#536078] dark:text-[#B8C4D8]">
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">Current workspace</p>
          <p className="mt-2 text-base font-semibold text-[#0B1630] dark:text-white">Quantara AI BOQ</p>
        </div>
      </div>
    </div>
  );
}
