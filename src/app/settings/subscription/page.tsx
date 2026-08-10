"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type Entitlements = {
  planType: string;
  planName: string;
  status: string;
  isTrial: boolean;
  isExpiredOrNone: boolean;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialDaysRemaining: number | null;
  maxProjects: number | null;
};

type TrialUsage = {
  projectsCreated: number;
  maxProjects: number;
  boqsCompleted: number;
  maxCompletedBoqs: number;
  documentsGenerated: number;
  maxFinalExports: number;
  proposalsCreated: number;
  maxProposals: number;
  uniquePremiumItemsUnlocked: number;
  maxUniquePremiumItems: number;
  unlockedItems: { masterItemId: string; name: string; usageCount: number }[];
} | null;

type PackageSubscription = {
  subscriptionId: string;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  package: { id: string; key: string; name: string; packageType: string; itemCount: number };
};

type SoftwarePlan = { id: string; key: string; name: string; description: string; planType: string; monthlyPrice: number; annualPrice: number; currency: string };

type CommercePriceSummary = {
  code: string;
  amountMinor: number;
  currency: string;
  billingInterval: "ONE_TIME" | "MONTH" | "YEAR";
  isFromPrice: boolean;
};

type CommerceProductSummary = {
  code: string;
  name: string;
  shortDescription: string;
  purchaseMode: "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
  prices: CommercePriceSummary[];
};

/** The three direct-checkout subscription tiers — see src/lib/entitlements/commerce-plan-mapping.ts for the matching entitlement mapping. */
const CHECKOUT_TIER_CODES = new Set(["starter", "professional", "business"]);

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function SubscriptionSettingsPage() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [trialUsage, setTrialUsage] = useState<TrialUsage>(null);
  const [packages, setPackages] = useState<PackageSubscription[]>([]);
  const [plans, setPlans] = useState<SoftwarePlan[]>([]);
  const [checkoutProducts, setCheckoutProducts] = useState<CommerceProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [entitlementsData, plansData, commerceProducts] = await Promise.all([
        apiClient.get<{ entitlements: Entitlements; trialUsage: TrialUsage; packages: PackageSubscription[] }>("/api/entitlements", signal),
        apiClient.get<SoftwarePlan[]>("/api/software-plans", signal),
        apiClient.get<CommerceProductSummary[]>("/api/commerce/products?type=SUBSCRIPTION", signal),
      ]);
      setEntitlements(entitlementsData.entitlements);
      setTrialUsage(entitlementsData.trialUsage);
      setPackages(entitlementsData.packages);
      setPlans(plansData);
      setCheckoutProducts(commerceProducts.filter((product) => CHECKOUT_TIER_CODES.has(product.code) && product.purchaseMode === "DIRECT"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const runAction = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    setActionError(null);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage("Done.");
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  const startTrial = useCallback(() => runAction("start-trial", async () => {
    await apiClient.post("/api/entitlements/start-trial", {});
  }), [runAction]);

  const acceptTerms = useCallback(() => runAction("accept-terms", async () => {
    await apiClient.post("/api/entitlements/accept-trial-terms", {});
  }), [runAction]);

  const activatePlan = useCallback((planKey: string) => runAction(`plan-${planKey}`, async () => {
    await apiClient.post("/api/entitlements/activate-development-plan", { planKey });
  }), [runAction]);

  const expirePlan = useCallback(() => runAction("expire-plan", async () => {
    await apiClient.post("/api/entitlements/expire-development-plan", {});
  }), [runAction]);

  const checkout = useCallback((priceCode: string) => runAction(`checkout-${priceCode}`, async () => {
    const result = await apiClient.post<{ checkoutUrl: string; checkoutSessionId: string }>("/api/commerce/checkout", { priceCode });
    window.location.href = result.checkoutUrl;
  }), [runAction]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading subscription</p>
      </div>
    );
  }

  if (loadError || !entitlements) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Subscription unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "Could not load subscription details."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Subscription</h1>
        <p className="mt-2 rounded-2xl border border-amber-900 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          Use &ldquo;Upgrade&rdquo; below for a real Stripe checkout. The &ldquo;Software plans (development)&rdquo; controls are a manual test control, not a real payment, and are kept only for internal testing.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current plan</p>
            <p className="mt-2 text-2xl font-semibold text-white">{entitlements.planName}</p>
            <p className="mt-1 text-xs text-slate-500">{entitlements.status}</p>
          </div>
          {entitlements.isTrial && (
            <>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Trial started</p>
                <p className="mt-2 text-lg font-semibold text-white">{entitlements.trialStartedAt ? formatDate(entitlements.trialStartedAt) : "—"}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Trial expires</p>
                <p className="mt-2 text-lg font-semibold text-white">{entitlements.trialExpiresAt ? formatDate(entitlements.trialExpiresAt) : "—"}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Days remaining</p>
                <p className="mt-2 text-2xl font-semibold text-white">{entitlements.trialDaysRemaining ?? "—"}</p>
              </div>
            </>
          )}
        </div>

        {entitlements.status === "NONE" && (
          <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-300">No subscription yet. Start your 3-day Pro trial.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void acceptTerms()} disabled={busyKey === "accept-terms"} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50">
                {busyKey === "accept-terms" ? "Saving…" : "Accept trial terms"}
              </button>
              <button type="button" onClick={() => void startTrial()} disabled={busyKey === "start-trial"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {busyKey === "start-trial" ? "Starting…" : "Start 3-day Pro trial"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Requires a verified email and a completed company profile (legal name, email, address, country, tax registration).</p>
          </div>
        )}

        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>

      {trialUsage && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">Trial usage</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <UsageCard label="Projects" used={trialUsage.projectsCreated} max={trialUsage.maxProjects} />
            <UsageCard label="Completed BOQs" used={trialUsage.boqsCompleted} max={trialUsage.maxCompletedBoqs} />
            <UsageCard label="Premium items" used={trialUsage.uniquePremiumItemsUnlocked} max={trialUsage.maxUniquePremiumItems} />
            <UsageCard label="Final exports" used={trialUsage.documentsGenerated} max={trialUsage.maxFinalExports} />
            <UsageCard label="Proposals" used={trialUsage.proposalsCreated} max={trialUsage.maxProposals} />
          </div>
          {trialUsage.unlockedItems.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Premium items unlocked</p>
              <div className="mt-2 space-y-1">
                {trialUsage.unlockedItems.map((item) => (
                  <div key={item.masterItemId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                    <span>{item.name}</span>
                    <span className="text-xs text-slate-500">used {item.usageCount}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {checkoutProducts.length > 0 && (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">Upgrade</h2>
          <p className="mt-1 text-sm text-slate-400">Real Stripe checkout — you will be redirected to a secure payment page.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {checkoutProducts.map((product) => (
              <div key={product.code} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{product.shortDescription}</p>
                <div className="mt-4 space-y-2">
                  {product.prices
                    .filter((price) => !price.isFromPrice)
                    .map((price) => (
                      <button
                        key={price.code}
                        type="button"
                        onClick={() => void checkout(price.code)}
                        disabled={busyKey === `checkout-${price.code}`}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        <span>{price.billingInterval === "MONTH" ? "Monthly" : price.billingInterval === "YEAR" ? "Annual" : "One-time"}</span>
                        <span>{busyKey === `checkout-${price.code}` ? "Redirecting…" : formatMoney(price.amountMinor, price.currency)}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Software plans (development)</h2>
        <p className="mt-1 text-sm text-slate-400">Development activation only — no payment is processed. Use &ldquo;Upgrade&rdquo; above for a real subscription.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{plan.planType}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
              <p className="mt-3 text-sm text-slate-300">{plan.monthlyPrice === 0 ? "Custom / contact sales" : `${plan.currency} ${plan.monthlyPrice}/mo`}</p>
              {plan.planType !== "TRIAL" && plan.planType !== "FREE" && (
                <button
                  type="button"
                  onClick={() => void activatePlan(plan.key)}
                  disabled={busyKey === `plan-${plan.key}`}
                  className="mt-4 w-full rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busyKey === `plan-${plan.key}` ? "Activating…" : "Activate (development)"}
                </button>
              )}
            </div>
          ))}
        </div>
        {entitlements.status !== "NONE" && (
          <button type="button" onClick={() => void expirePlan()} disabled={busyKey === "expire-plan"} className="mt-6 rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50">
            {busyKey === "expire-plan" ? "Expiring…" : "Expire current plan (development)"}
          </button>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Industry data packages</h2>
        <p className="mt-1 text-sm text-slate-400">Manage purchased packages from the Data Packages settings page or the Marketplace.</p>
        <div className="mt-4 space-y-2">
          {packages.map((sub) => (
            <div key={sub.subscriptionId} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <div>
                <p className="text-white">{sub.package.name}</p>
                <p className="text-xs text-slate-500">{sub.package.itemCount} items · {sub.status}</p>
              </div>
              <p className="text-xs text-slate-500">{sub.expiresAt ? `Expires ${formatDate(sub.expiresAt)}` : "No expiry"}</p>
            </div>
          ))}
          {packages.length === 0 && <p className="text-sm text-slate-500">No industry data packages yet. Visit the Marketplace to explore packages.</p>}
        </div>
      </div>
    </div>
  );
}

function UsageCard({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{used} / {max}</p>
    </div>
  );
}
