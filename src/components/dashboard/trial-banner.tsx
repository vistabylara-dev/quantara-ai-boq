"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900 bg-blue-950/30 px-5 py-3 text-sm text-blue-200">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-semibold text-white">Pro Trial — {trialUsage.trialDaysRemaining ?? 0} day{trialUsage.trialDaysRemaining === 1 ? "" : "s"} remaining</span>
        <span className="text-xs text-blue-300">Premium items used: {trialUsage.uniquePremiumItemsUnlocked}/{trialUsage.maxUniquePremiumItems}</span>
        <span className="text-xs text-blue-300">BOQs used: {trialUsage.boqsCompleted}/{trialUsage.maxCompletedBoqs}</span>
        <span className="text-xs text-blue-300">Documents used: {trialUsage.documentsGenerated}/{trialUsage.maxFinalExports}</span>
      </div>
      <Link href="/settings/subscription" className="rounded-full border border-blue-700 bg-blue-900/50 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-900">
        Upgrade
      </Link>
    </div>
  );
}
