"use client";

import Link from "next/link";
import { Crown, Menu, Search } from "lucide-react";
import UserMenu from "./user-menu";

import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { useTranslations } from "@/lib/i18n/locale-provider";
import NotificationCenter from "@/components/notifications/notification-center";

type TopHeaderProps = {
  onMenuClick: () => void;
};

export default function TopHeader({ onMenuClick }: TopHeaderProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/40 backdrop-blur-xl px-4 py-6 sm:px-6 xl:px-8 relative z-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="terminal-text text-[10px] uppercase tracking-[0.4em] text-blue-600 dark:text-[#00F0FF] mb-1">System Node // Dashboard</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide uppercase">{t("navigation.workspaceHeading")}</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/subscription"
            aria-label={t("navigation.upgrade")}
            className="inline-flex h-11 items-center gap-2 border border-blue-500/30 bg-blue-500/10 px-4 text-sm font-semibold text-blue-600 hover:bg-blue-500/20 transition-all dark:border-[#00F0FF]/30 dark:bg-[#00F0FF]/10 dark:text-[#00F0FF] dark:hover:bg-[#00F0FF]/20"
          >
            <Crown className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("navigation.upgrade")}</span>
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t("a11y.openNavigationMenu")}
            className="inline-flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-[#00F0FF]/10 dark:hover:text-[#00F0FF] dark:hover:border-[#00F0FF]/30 xl:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <NotificationCenter />
          <UserMenu />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] mt-2">
        <label className="group relative block">
          <span className="sr-only">{t("navigation.searchLabel")}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-[#00F0FF] transition-colors" aria-hidden="true" />
          <input
            type="search"
            placeholder={t("navigation.searchPlaceholder")}
            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 ps-12 pe-12 py-4 text-sm text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-blue-50/50 dark:focus:border-[#00F0FF]/50 dark:focus:bg-[#00F0FF]/5 terminal-text"
          />
          <div className="absolute end-4 top-1/2 -translate-y-1/2 terminal-text text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-0.5" dir="ltr">CTRL+K</div>
        </label>
        <div className="border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-4 text-sm flex items-center justify-between cyber-border">
          <div>
            <p className="terminal-text text-[9px] uppercase tracking-widest text-slate-500 mb-1">{t("navigation.activeProject")}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-widest uppercase">Global Headquarters</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-blue-500/30 dark:border-[#00F0FF]/30 flex items-center justify-center bg-blue-500/10 dark:bg-[#00F0FF]/10">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-[#00F0FF] animate-ping"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
