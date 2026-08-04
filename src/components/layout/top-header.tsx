"use client";

import { Bell, Menu, Search } from "lucide-react";
import UserMenu from "./user-menu";

type TopHeaderProps = {
  onMenuClick: () => void;
};

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 bg-black/40 backdrop-blur-xl px-4 py-6 sm:px-6 xl:px-8 relative z-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="terminal-text text-[10px] uppercase tracking-[0.4em] text-[#00F0FF] mb-1">System Node // Dashboard</p>
          <h1 className="text-2xl font-bold text-white tracking-wide uppercase">Workspace</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center border border-white/10 bg-white/5 text-slate-300 hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all xl:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-11 w-11 items-center justify-center border border-white/10 bg-white/5 text-slate-300 hover:bg-[#00F0FF]/10 hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF0055] animate-pulse"></span>
          </button>
          <UserMenu />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] mt-2">
        <label className="group relative block">
          <span className="sr-only">Search workspace</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00F0FF] transition-colors" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search data nodes..."
            className="w-full border border-white/10 bg-black/20 px-12 py-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-[#00F0FF]/50 focus:bg-[#00F0FF]/5 terminal-text"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 terminal-text text-[10px] text-slate-500 border border-slate-700 px-2 py-0.5">CTRL+K</div>
        </label>
        <div className="border border-white/10 bg-black/20 p-4 text-sm flex items-center justify-between cyber-border">
          <div>
            <p className="terminal-text text-[9px] uppercase tracking-widest text-slate-500 mb-1">Active Project</p>
            <p className="text-sm font-bold text-white tracking-widest uppercase">Global Headquarters</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-[#00F0FF]/30 flex items-center justify-center bg-[#00F0FF]/10">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
