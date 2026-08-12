"use client";

import { useCallback, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import type { CommercialAccessDecision, CommercialRequirement } from "@/lib/commercial/commercial-types";

/**
 * CANVA-MODEL-1 — the unlock screen. Shown when a user requests the CLEAN
 * FINAL export of a BOQ that still has unmet commercial requirements. Every
 * price/offer shown here comes from the server decision passed in — never
 * hardcoded. This component never imports anything from src/lib/payments,
 * src/lib/services/stripe-*, or src/app/api/commerce; checkout is invoked
 * through a generic, domain-named endpoint contract (POST
 * /api/commerce/checkout-session) that the commerce/Stripe layer owns and
 * implements — if that endpoint isn't live yet, this shows an honest
 * "checkout isn't available yet" state rather than faking success.
 */

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RequirementRow({ requirement }: { requirement: CommercialRequirement }) {
  const offer = requirement.offers[0];
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-white">{requirement.displayName}</p>
        <p className="text-xs text-slate-400">{requirement.reason}</p>
        {typeof requirement.usageCount === "number" && (
          <p className="mt-1 text-xs text-amber-300">
            {requirement.usageCount} BOQ item{requirement.usageCount === 1 ? "" : "s"} used
          </p>
        )}
      </div>
      <div className="whitespace-nowrap text-right">
        {offer ? (
          offer.checkoutAvailable ? (
            <p className="text-sm font-semibold text-white">
              {formatMoney(offer.amountMinor, offer.currency)}
              <span className="text-xs font-normal text-slate-400">/{offer.billingInterval === "MONTH" ? "month" : "year"}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-400">{offer.unavailableReason ?? "Pricing unavailable"}</p>
          )
        ) : (
          <p className="text-xs text-slate-500">—</p>
        )}
      </div>
    </div>
  );
}

export type CommercialUnlockPanelProps = {
  boqId: string;
  decision: CommercialAccessDecision;
  onWorkSaved?: () => void;
};

export function CommercialUnlockPanel({ boqId, decision, onWorkSaved }: CommercialUnlockPanelProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const totalDueMinor = decision.requirements.reduce((sum, r) => sum + (r.offers[0]?.amountMinor ?? 0), 0);
  const currency = decision.requirements.find((r) => r.offers[0])?.offers[0]?.currency ?? "AED";
  const anyOfferUnavailable = decision.requirements.some((r) => !r.offers[0]?.checkoutAvailable);

  const handleUnlock = useCallback(async () => {
    setCheckoutError(null);
    setIsRedirecting(true);
    onWorkSaved?.();
    try {
      const result = await apiClient.post<{ checkoutUrl: string | null; unavailableReason: string | null }>(
        "/api/commerce/checkout-session",
        { boqId, manifestFingerprint: decision.manifestFingerprint },
      );
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setCheckoutError(result.unavailableReason ?? "Checkout isn't available yet. Your work is saved — try again shortly.");
    } catch (error) {
      setCheckoutError(getApiErrorMessage(error) || "Checkout isn't available yet. Your work is saved — try again shortly.");
    } finally {
      setIsRedirecting(false);
    }
  }, [boqId, decision.manifestFingerprint, onWorkSaved]);

  if (decision.status === "ALLOW" || decision.requirements.length === 0) return null;

  return (
    <div role="dialog" aria-label="Your professional BOQ is ready" className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">Your professional BOQ is ready</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Everything you created is saved.</h2>
      <p className="mt-2 text-sm text-slate-400">To download the clean version, your BOQ needs:</p>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
        {decision.requirements.map((requirement) => (
          <RequirementRow key={`${requirement.type}:${requirement.key}`} requirement={requirement} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-blue-900/40 bg-blue-950/20 px-5 py-4">
        <span className="text-sm font-semibold text-blue-200">Total due today</span>
        <span className="text-lg font-bold text-white">{formatMoney(totalDueMinor, currency)}</span>
      </div>

      {anyOfferUnavailable && (
        <p className="mt-3 text-xs text-amber-300">Some items above don&apos;t have checkout pricing configured yet — contact us to unlock those.</p>
      )}
      {checkoutError && <p className="mt-3 text-xs text-rose-300">{checkoutError}</p>}

      <p className="mt-6 text-xs text-slate-500">Your work is saved. You can return anytime.</p>

      <button
        type="button"
        onClick={() => void handleUnlock()}
        disabled={isRedirecting}
        className="mt-4 w-full rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRedirecting ? "Redirecting to checkout…" : "Unlock My BOQ"}
      </button>
    </div>
  );
}

export default CommercialUnlockPanel;
