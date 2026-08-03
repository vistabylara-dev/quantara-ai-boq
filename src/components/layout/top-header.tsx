"use client";

import { Bell, Menu, Search } from "lucide-react";
import UserMenu from "./user-menu";

type TopHeaderProps = {
  onMenuClick: () => void;
};

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] px-4 py-4 sm:px-6 xl:px-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[#7B879C] dark:text-[#7F8DA6]">Quantara AI</p>
          <h1 className="text-xl font-semibold text-[#08152E] dark:text-white sm:text-2xl">Quantity Intelligence Workspace</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] text-[#536078] dark:text-[#B8C4D8] hover:bg-white dark:hover:bg-[#091326] xl:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3]"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] text-[#536078] dark:text-[#B8C4D8] hover:bg-white dark:hover:bg-[#091326] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#21C7F3]"
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
            className="w-full rounded-2xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] px-12 py-3 text-sm text-[#08152E] dark:text-white outline-none transition-colors placeholder:text-[#7B879C] dark:placeholder:text-[#7F8DA6] focus:border-[#009FE3] dark:focus:border-[#21C7F3] focus:ring-2 focus:ring-[#009FE3]/20 dark:focus:ring-[#21C7F3]/20"
          />
        </label>
        <div className="rounded-3xl border border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#101D34] p-4 text-sm text-[#536078] dark:text-[#B8C4D8]">
          <p className="text-[#7B879C] dark:text-[#7F8DA6]">Current workspace</p>
          <p className="mt-2 text-base font-semibold text-[#08152E] dark:text-white">Quantara AI BOQ</p>
        </div>
      </div>
    </div>
  );
}
