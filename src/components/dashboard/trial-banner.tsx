"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

type TrialUsage = {
  trialDaysRemaining: number | null;
  boqsCompleted: number;
  maxCompletedBoqs: number;
  documentsGenerated: number;
  maxFinalExports: number;
  uniquePremiumItemsUnlocked: number;
  maxUniquePremiumItems: number;
} | null;

/** Restrained, single-line banner — never an intrusive popup (spec Phase 7 amendment section 12). */
export default function TrialBanner() {
  const t = useTranslations();
  const [trialUsage, setTrialUsage] = useState<TrialUsage>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<{ trialUsage: TrialUsage }>("/api/entitlements", controller.signal)
      .then((data) => setTrialUsage(data.trialUsage))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!trialUsage) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 px-5 py-3 text-sm dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-semibold text-[#08152E] dark:text-white">
          {t(trialUsage.trialDaysRemaining === 1 ? "dashboardComponents.trialBanner.titleOne" : "dashboardComponents.trialBanner.titleOther", { days: trialUsage.trialDaysRemaining ?? 0 })}
        </span>
        <span className="text-xs text-[#536078] dark:text-[#8CA0BE]">
          {t("dashboardComponents.trialBanner.premiumItemsUsed", { used: trialUsage.uniquePremiumItemsUnlocked, max: trialUsage.maxUniquePremiumItems })}
        </span>
        <span className="text-xs text-[#536078] dark:text-[#8CA0BE]">
          {t("dashboardComponents.trialBanner.boqsUsed", { used: trialUsage.boqsCompleted, max: trialUsage.maxCompletedBoqs })}
        </span>
        <span className="text-xs text-[#536078] dark:text-[#8CA0BE]">
          {t("dashboardComponents.trialBanner.documentsUsed", { used: trialUsage.documentsGenerated, max: trialUsage.maxFinalExports })}
        </span>
      </div>
      <Link href="/settings/subscription" className="rounded-full border border-[#009FE3]/40 bg-[#009FE3]/10 px-4 py-1.5 text-xs font-semibold text-[#0077B6] hover:bg-[#009FE3]/20 dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10 dark:text-[#21C7F3] dark:hover:bg-[#21C7F3]/20">
        {t("dashboardComponents.trialBanner.upgrade")}
      </Link>
    </div>
  );
}
