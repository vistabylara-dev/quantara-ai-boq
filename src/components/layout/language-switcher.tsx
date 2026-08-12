"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/config";

/**
 * Compact EN / العربية toggle. Preserves the current route, project, and
 * auth session — setLocale() only writes a cookie and calls
 * router.refresh() (see locale-provider.tsx), never router.push/replace to
 * a different path and never a full reload.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t("languageSwitcher.label")}
      className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5"
    >
      {SUPPORTED_LOCALES.map((candidate) => {
        const isActive = candidate === locale;
        const label = LOCALE_LABELS[candidate].short;
        const actionLabel = candidate === "ar" ? t("languageSwitcher.switchToArabic") : t("languageSwitcher.switchToEnglish");
        return (
          <button
            key={candidate}
            type="button"
            onClick={() => setLocale(candidate)}
            aria-pressed={isActive}
            aria-label={actionLabel}
            className={`min-h-[32px] min-w-[32px] rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-[#00F0FF] ${
              isActive
                ? "bg-blue-600 text-white dark:bg-[#00F0FF]/20 dark:text-[#00F0FF]"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;
