import { Bell, Menu, Search } from "lucide-react";
import UserMenu from "./user-menu";

export default function TopHeader() {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950 px-4 py-4 sm:px-6 xl:px-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Quantara AI</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Quantity Intelligence Workspace</h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">
            <Menu className="h-5 w-5" />
          </button>
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">
            <Bell className="h-5 w-5" />
          </button>
          <UserMenu />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <label className="group relative block">
          <span className="sr-only">Search workspace</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="Search projects, BOQs, clients"
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-12 py-3 text-sm text-white outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="text-slate-400">Current workspace</p>
          <p className="mt-2 text-base font-semibold text-white">Quantara AI BOQ</p>
        </div>
      </div>
    </div>
  );
}
