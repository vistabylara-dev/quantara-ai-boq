"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckoutReturnStatus } from "@/components/commercial/checkout-return-status";
import { RefundRequestPanel } from "@/components/commercial/refund-request-panel";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import {
  clearPendingPricingIntent,
  normalizePublicPriceCode,
  readPendingPricingIntent,
  storePendingPricingIntent,
  type TrustedPublicPriceCode,
} from "@/lib/commercial/pricing-intent";
import { formatDate } from "@/lib/formatting/dates";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";

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

type SoftwarePlan = {
  id: string;
  key: string;
  name: string;
  description: string;
  planType: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
};

type CheckoutUnavailableReason =
  | "PRICE_NOT_APPROVED"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_MAPPING_NOT_SYNCED"
  | "EXISTING_SUBSCRIPTION";

type CheckoutOptionPrice = {
  priceCode: string;
  billingInterval: "MONTH" | "YEAR";
  amountMinor: number;
  currency: string;
  available: boolean;
  unavailableReason: CheckoutUnavailableReason | null;
};

type CheckoutOptionProduct = {
  productCode: string;
  name: string;
  shortDescription: string;
  prices: CheckoutOptionPrice[];
};

type CheckoutAvailability = { hasExistingSubscription: boolean; products: CheckoutOptionProduct[] };
type BillingInterval = "MONTH" | "YEAR";
type SoftwareProductCode = "starter" | "professional" | "business";

const SOFTWARE_PRODUCT_ORDER: SoftwareProductCode[] = ["starter", "professional", "business"];

const SOFTWARE_PLAN_UI: Record<
  SoftwareProductCode,
  { badge: string; positioning: string; benefits: string[]; recommended?: boolean }
> = {
  starter: {
    badge: "ESSENTIAL",
    positioning: "For individual professionals and smaller estimating or QS teams getting started with Quantara.",
    benefits: [
      "Up to 3 active projects",
      "Core BOQ project workspace",
      "BOQ creation and editing workflow",
      "Project revisions and verification workflow",
      "Client and supplier workflows",
      "Document and proposal workflows",
      "Industry Data Packages available separately",
    ],
  },
  professional: {
    badge: "MOST POPULAR",
    recommended: true,
    positioning: "For active contractors, estimators and QS teams managing multiple projects in parallel.",
    benefits: [
      "Up to 15 active projects",
      "Built for multiple concurrent estimates and projects",
      "BOQ creation, editing and revisions",
      "Verification and project workflow",
      "Client and supplier workflows",
      "Document and proposal workflows",
      "Industry Data Packages available separately",
    ],
  },
  business: {
    badge: "FOR SCALE",
    positioning: "For companies managing a high volume of projects across larger teams and operations.",
    benefits: [
      "Unlimited active projects",
      "Everything in the core Quantara workflow",
      "Designed for larger project portfolios",
      "Built for high-volume project operations",
      "BOQ, revision and verification workflows",
      "Client, supplier, document and proposal workflows",
      "Industry Data Packages available separately",
    ],
  },
};

const TAYQAN_UI = {
  DAY: {
    badge: "QUICK HIRE",
    title: "TAYQAN Day",
    bestFor: "Urgent BOQ work, reviews or short QS assignments.",
    cta: "Hire TAYQAN for 1 Day",
    benefits: [
      "Project inspection and quantity work",
      "BOQ preparation or review",
      "Governed QS workflow",
      "Human-ready project output",
    ],
  },
  WEEK: {
    badge: "MOST POPULAR",
    title: "TAYQAN Week",
    bestFor: "Active projects requiring several days of focused QS work.",
    cta: "Hire TAYQAN for 1 Week",
    benefits: [
      "Multi-day project inspection",
      "Quantity and BOQ work",
      "BOQ preparation or review",
      "Governed rate preparation when requested",
      "Resumable work orders across the hire period",
    ],
  },
  MONTHLY: {
    badge: "DIGITAL QS",
    title: "TAYQAN Monthly",
    bestFor: "Companies that need ongoing quantity-surveying capacity across changing project workloads.",
    cta: "Hire TAYQAN Monthly",
    benefits: [
      "Recurring Digital QS hire",
      "Persistent support across project workflows",
      "Project inspection and quantity work",
      "BOQ preparation and review",
      "Ongoing governed QS assistance",
      "Final professional acceptance remains under human control",
    ],
  },
} as const;

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function unavailableLabel(reason: CheckoutUnavailableReason | null): string {
  switch (reason) {
    case "EXISTING_SUBSCRIPTION":
      return "Already subscribed";
    case "PRICE_NOT_APPROVED":
    case "PROVIDER_MAPPING_MISSING":
    case "PROVIDER_MAPPING_NOT_SYNCED":
      return "Setup pending";
    default:
      return "Unavailable";
  }
}

function annualSavingPercent(product: CheckoutOptionProduct): number | null {
  const monthly = product.prices.find((price) => price.billingInterval === "MONTH");
  const annual = product.prices.find((price) => price.billingInterval === "YEAR");
  if (!monthly || !annual || monthly.amountMinor <= 0) return null;
  const paidMonthlyForYear = monthly.amountMinor * 12;
  if (annual.amountMinor >= paidMonthlyForYear) return null;
  return Math.round((1 - annual.amountMinor / paidMonthlyForYear) * 100);
}

function SubscriptionSettingsContent() {
  const searchParams = useSearchParams();
  const [selectedPricingIntent, setSelectedPricingIntent] = useState<TrustedPublicPriceCode | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [trialUsage, setTrialUsage] = useState<TrialUsage>(null);
  const [packages, setPackages] = useState<PackageSubscription[]>([]);
  const [plans, setPlans] = useState<SoftwarePlan[]>([]);
  const [checkoutAvailability, setCheckoutAvailability] = useState<CheckoutAvailability | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTH");
  const [isTestCompany, setIsTestCompany] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [entitlementsData, plansData, availabilityResult] = await Promise.all([
        apiClient.get<{
          entitlements: Entitlements;
          trialUsage: TrialUsage;
          packages: PackageSubscription[];
          isTestCompany: boolean;
        }>("/api/entitlements", signal),
        apiClient.get<SoftwarePlan[]>("/api/software-plans", signal),
        apiClient.get<CheckoutAvailability>("/api/commerce/checkout-options", signal).then(
          (value) => value,
          () => null,
        ),
      ]);
      setEntitlements(entitlementsData.entitlements);
      setTrialUsage(entitlementsData.trialUsage);
      setPackages(entitlementsData.packages);
      setIsTestCompany(entitlementsData.isTestCompany);
      setPlans(plansData);
      setCheckoutAvailability(availabilityResult);
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

  useEffect(() => {
    const queryPriceCode = normalizePublicPriceCode(searchParams.get("priceCode"));
    if (queryPriceCode) {
      storePendingPricingIntent(queryPriceCode);
      setSelectedPricingIntent(queryPriceCode);
    } else {
      setSelectedPricingIntent(readPendingPricingIntent());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedPricingIntent || !checkoutAvailability) return;
    const selectedPrice = checkoutAvailability.products
      .flatMap((product) => product.prices)
      .find((price) => price.priceCode === selectedPricingIntent);

    if (selectedPrice?.billingInterval === "YEAR") {
      setBillingInterval("YEAR");
    } else if (selectedPrice?.billingInterval === "MONTH") {
      setBillingInterval("MONTH");
    }
  }, [checkoutAvailability, selectedPricingIntent]);

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
    const result = await apiClient.post<{ checkoutUrl: string; checkoutSessionId: string }>(
      "/api/commerce/checkout",
      { priceCode },
    );
    clearPendingPricingIntent();
    window.location.href = result.checkoutUrl;
  }), [runAction]);

  const manageBilling = useCallback(() => runAction("manage-billing", async () => {
    const result = await apiClient.post<{ portalUrl: string }>("/api/commerce/billing-portal", {});
    window.location.href = result.portalUrl;
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

  const softwareProducts = SOFTWARE_PRODUCT_ORDER.map((productCode) =>
    checkoutAvailability?.products.find((product) => product.productCode === productCode),
  ).filter((product): product is CheckoutOptionProduct => Boolean(product));

  const hasExistingSubscription = checkoutAvailability?.hasExistingSubscription ?? false;
  const projectAllowance =
    entitlements.status === "NONE"
      ? "—"
      : entitlements.maxProjects === null
        ? "Unlimited"
        : entitlements.maxProjects.toLocaleString();

  return (
    <div className="space-y-10 pb-8">
      <Suspense fallback={null}>
        <CheckoutReturnStatus />
      </Suspense>

      <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/30 px-6 py-8 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Quantara account</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Subscription &amp; Billing</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            Choose the Quantara plan that matches the way your team delivers projects, or hire TAYQAN when you want a Digital Quantity Surveyor to work alongside you.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
            <div className="flex-1 rounded-[28px] border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-black/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Current plan</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">{entitlements.planName}</h2>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                      {entitlements.status}
                    </span>
                  </div>
                </div>

                {hasExistingSubscription && (
                  <button
                    type="button"
                    onClick={() => void manageBilling()}
                    disabled={busyKey === "manage-billing"}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === "manage-billing" ? "Opening…" : "Manage Billing"}
                  </button>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryItem label="Plan status" value={entitlements.status} />
                <SummaryItem label="Active projects" value={String(projectAllowance)} />
                <SummaryItem
                  label="Trial remaining"
                  value={entitlements.isTrial ? `${entitlements.trialDaysRemaining ?? "—"} days` : "Not on trial"}
                />
                <SummaryItem
                  label="Trial expiry"
                  value={entitlements.isTrial && entitlements.trialExpiresAt ? formatDate(entitlements.trialExpiresAt) : "—"}
                />
              </div>

              {hasExistingSubscription && (
                <div className="mt-6 border-t border-slate-800 pt-6">
                  <RefundRequestPanel planName={entitlements.planName} hasActiveSubscription />
                </div>
              )}
            </div>

            {entitlements.status === "NONE" && (
              <div className="w-full rounded-[28px] border border-cyan-400/20 bg-cyan-400/5 p-6 xl:max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Try Quantara Professional</p>
                <h2 className="mt-3 text-xl font-semibold text-white">Start your 3-day Pro trial</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Trial rules stay exactly as configured. A verified email, completed company profile and accepted trial terms are still required.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row xl:flex-col">
                  <button
                    type="button"
                    onClick={() => void acceptTerms()}
                    disabled={busyKey === "accept-terms"}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                  >
                    {busyKey === "accept-terms" ? "Saving…" : "Accept trial terms"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startTrial()}
                    disabled={busyKey === "start-trial"}
                    className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50"
                  >
                    {busyKey === "start-trial" ? "Starting…" : "Start 3-day Pro trial"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {isTestCompany && (
            <p className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-200">
              Sandbox/test company detected. Development plan controls remain available below and do not process a payment.
            </p>
          )}

          {(actionMessage || actionError) && (
            <div className={`mt-5 rounded-2xl border p-4 text-sm ${
              actionError
                ? "border-rose-900 bg-rose-950/30 text-rose-300"
                : "border-emerald-900 bg-emerald-950/30 text-emerald-300"
            }`}>
              {actionError ?? actionMessage}
            </div>
          )}
        </div>
      </section>

      {trialUsage && (
        <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Trial</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Trial usage</h2>
          <p className="mt-2 text-sm text-slate-400">Live usage against your existing trial limits.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <UsageCard label="Projects" used={trialUsage.projectsCreated} max={trialUsage.maxProjects} />
            <UsageCard label="Completed BOQs" used={trialUsage.boqsCompleted} max={trialUsage.maxCompletedBoqs} />
            <UsageCard label="Premium items" used={trialUsage.uniquePremiumItemsUnlocked} max={trialUsage.maxUniquePremiumItems} />
            <UsageCard label="Final exports" used={trialUsage.documentsGenerated} max={trialUsage.maxFinalExports} />
            <UsageCard label="Proposals" used={trialUsage.proposalsCreated} max={trialUsage.maxProposals} />
          </div>
        </section>
      )}

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Quantara software</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Choose your Quantara workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Select the software plan that matches the number of active projects your team manages. Industry Data Packages are purchased separately when specialist catalogue content is required.
            </p>
          </div>

          <div className="inline-flex w-fit rounded-xl border border-slate-700 bg-slate-900 p-1" aria-label="Billing interval">
            {(["MONTH", "YEAR"] as BillingInterval[]).map((interval) => (
              <button
                key={interval}
                type="button"
                aria-pressed={billingInterval === interval}
                onClick={() => setBillingInterval(interval)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  billingInterval === interval ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {interval === "MONTH" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>

        {checkoutAvailability ? (
          <>
            {hasExistingSubscription && (
              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-slate-300">
                  Your company already has a software subscription. Use Manage Billing for payment method, invoice or cancellation changes; duplicate software checkout stays disabled.
                </p>
                <button
                  type="button"
                  onClick={() => void manageBilling()}
                  disabled={busyKey === "manage-billing"}
                  className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                >
                  {busyKey === "manage-billing" ? "Opening…" : "Manage Billing"}
                </button>
              </div>
            )}

            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              {softwareProducts.map((product) => {
                const code = product.productCode as SoftwareProductCode;
                const meta = SOFTWARE_PLAN_UI[code];
                const price = product.prices.find((candidate) => candidate.billingInterval === billingInterval);
                const annualSaving = annualSavingPercent(product);
                const isSelectedPricingIntent = price?.priceCode === selectedPricingIntent;
                const currentPlan = entitlements.planName.trim().toLowerCase() === product.name.trim().toLowerCase();
                const busy = price !== undefined && busyKey === `checkout-${price.priceCode}`;
                const disabled = !price || !price.available || hasExistingSubscription || currentPlan;

                let ctaLabel = `Choose ${product.name}`;
                if (currentPlan) ctaLabel = "Current plan";
                else if (hasExistingSubscription) ctaLabel = "Manage existing plan";
                else if (!price) ctaLabel = "Not available";
                else if (!price.available) ctaLabel = unavailableLabel(price.unavailableReason);
                else if (busy) ctaLabel = "Redirecting…";
                else if (entitlements.status !== "NONE") ctaLabel = `Upgrade to ${product.name}`;

                return (
                  <article
                    key={product.productCode}
                    className={`relative flex h-full flex-col rounded-[28px] border p-6 transition ${
                      meta.recommended
                        ? "border-cyan-400/45 bg-gradient-to-b from-cyan-400/10 to-slate-900 shadow-xl shadow-cyan-950/20"
                        : "border-slate-800 bg-slate-900/80"
                    } ${isSelectedPricingIntent ? "ring-2 ring-cyan-400/70" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        meta.recommended
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                      }`}>
                        {meta.badge}
                      </span>
                      {isSelectedPricingIntent && <span className="text-xs font-semibold text-cyan-300">Selected</span>}
                    </div>

                    <h3 className="mt-5 text-2xl font-semibold text-white">{product.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{meta.positioning}</p>

                    <div className="mt-6 border-y border-slate-800 py-5">
                      {price ? (
                        <>
                          <div className="flex flex-wrap items-end gap-2">
                            <span className="text-3xl font-semibold tracking-tight text-white">
                              {formatMoney(price.amountMinor, price.currency)}
                            </span>
                            <span className="pb-1 text-sm text-slate-500">/{billingInterval === "MONTH" ? "month" : "year"}</span>
                          </div>
                          {billingInterval === "YEAR" && annualSaving !== null && (
                            <p className="mt-2 text-xs font-semibold text-emerald-300">
                              Save about {annualSaving}% compared with paying monthly
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-lg font-semibold text-slate-500">Pricing unavailable</p>
                      )}
                    </div>

                    <ul className="mt-6 flex-1 space-y-3">
                      {meta.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-3 text-sm leading-5 text-slate-300">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-hidden="true" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() =>
                        price &&
                        price.available &&
                        !hasExistingSubscription &&
                        !currentPlan &&
                        void checkout(price.priceCode)
                      }
                      disabled={disabled || busy}
                      title={price && !price.available ? unavailableLabel(price.unavailableReason) : undefined}
                      aria-current={isSelectedPricingIntent ? "true" : undefined}
                      data-selected-pricing-intent={isSelectedPricingIntent ? "true" : undefined}
                      className={`mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                        meta.recommended
                          ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                          : "bg-white text-slate-950 hover:bg-slate-200"
                      }`}
                    >
                      {ctaLabel}
                    </button>
                  </article>
                );
              })}
            </div>

            {softwareProducts.length === 0 && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
                Software checkout options are not currently available. No purchase button is shown until the existing commerce availability endpoint returns approved plan pricing.
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="font-semibold text-white">Checkout availability is temporarily unavailable</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your current plan and data libraries are still available. Upgrade buttons appear only when the existing checkout availability service confirms approved pricing.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[32px] border border-indigo-400/20 bg-slate-950">
        <div className="border-b border-indigo-400/15 bg-gradient-to-br from-indigo-500/10 via-slate-950 to-cyan-500/5 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">Need more than software?</p>
              <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Hire TAYQAN — Your Digital Quantity Surveyor</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                When you do not have time to complete the quantity-surveying work yourself, hire TAYQAN to work through the project with you.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm leading-6 text-slate-400">
              <span className="font-semibold text-white">Quantara Software</span> is the workspace you use to manage and deliver the work.
              <br />
              <span className="font-semibold text-indigo-200">TAYQAN Digital QS</span> is the AI worker you hire to perform governed QS work with you.
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-3">
          {TAYQAN_HIRE_PLANS.map((plan) => {
            const meta = TAYQAN_UI[plan.plan];
            const isWeek = plan.plan === "WEEK";
            const subtitle =
              plan.plan === "DAY"
                ? `${plan.durationHours ?? 24}-hour Digital QS hire`
                : plan.plan === "WEEK"
                  ? `${(plan.durationHours ?? 168) / 24}-day Digital QS hire`
                  : "Your persistent Digital Quantity Surveyor";

            return (
              <article
                key={plan.priceCode}
                className={`flex h-full flex-col rounded-[28px] border p-6 ${
                  isWeek
                    ? "border-indigo-300/40 bg-indigo-400/10 shadow-xl shadow-indigo-950/20"
                    : "border-slate-800 bg-slate-900/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    isWeek
                      ? "border-indigo-300/30 bg-indigo-300/10 text-indigo-200"
                      : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}>
                    {meta.badge}
                  </span>
                  <span className="text-xs text-slate-500">{plan.checkoutMode === "payment" ? "One-time hire" : "Monthly hire"}</span>
                </div>

                <h3 className="mt-5 text-2xl font-semibold text-white">{meta.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

                <div className="mt-5 flex items-end gap-2 border-y border-slate-800 py-5">
                  <span className="text-3xl font-semibold tracking-tight text-white">
                    {formatMoney(plan.amountMinor, plan.currency)}
                  </span>
                  {plan.plan === "MONTHLY" && <span className="pb-1 text-sm text-slate-500">/month</span>}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.plan === "DAY" && (
                    <>
                      <li className="flex gap-3 text-sm leading-5 text-slate-300">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-300" aria-hidden="true" />
                        <span>{plan.durationHours ?? 24} hours of TAYQAN access</span>
                      </li>
                      {plan.maxDistinctProjects !== null && (
                        <li className="flex gap-3 text-sm leading-5 text-slate-300">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-300" aria-hidden="true" />
                          <span>Up to {plan.maxDistinctProjects} distinct projects during the hire</span>
                        </li>
                      )}
                    </>
                  )}

                  {plan.plan === "WEEK" && (
                    <li className="flex gap-3 text-sm leading-5 text-slate-300">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-300" aria-hidden="true" />
                      <span>{(plan.durationHours ?? 168) / 24} days of TAYQAN access</span>
                    </li>
                  )}

                  {meta.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm leading-5 text-slate-300">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-300" aria-hidden="true" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-xl bg-slate-950/60 p-3 text-xs leading-5 text-slate-400">
                  <span className="font-semibold text-slate-200">Best for:</span> {meta.bestFor}
                </div>

                <Link
                  href="/projects?tayqan=assign"
                  className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                    isWeek
                      ? "bg-indigo-300 text-slate-950 hover:bg-indigo-200"
                      : "bg-white text-slate-950 hover:bg-slate-200"
                  }`}
                >
                  {meta.cta}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Purchased separately</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Your Industry Data Libraries</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Specialist data packages extend your Quantara catalogue with industry-specific items and technical references.
            </p>
          </div>
          <Link href="/marketplace" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400">
            Explore Marketplace
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {packages.map((sub) => (
            <div
              key={sub.subscriptionId}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{sub.package.name}</p>
                <p className="mt-1 text-xs text-slate-500">{sub.package.itemCount.toLocaleString()} items · {sub.status}</p>
              </div>
              <p className="text-xs text-slate-500">{sub.expiresAt ? `Expires ${formatDate(sub.expiresAt)}` : "No expiry"}</p>
            </div>
          ))}

          {packages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 lg:col-span-2">
              <p className="font-semibold text-white">No Industry Data Libraries yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Visit the Marketplace when you need specialist catalogue content. Packages remain separate from your Quantara software plan.
              </p>
            </div>
          )}
        </div>
      </section>

      {isTestCompany && (
        <details className="rounded-[28px] border border-amber-500/20 bg-amber-500/5">
          <summary className="cursor-pointer px-6 py-5 text-sm font-semibold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300">
            Sandbox Controls — development only
          </summary>
          <div className="border-t border-amber-500/15 p-6">
            <p className="text-sm leading-6 text-amber-100/70">
              Manual development activation only. No payment is processed here, and these controls are visible only because this company is marked as a test company.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-amber-500/15 bg-slate-950/70 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200/60">{plan.planType}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</p>
                  <p className="mt-3 text-sm text-slate-300">
                    {plan.monthlyPrice === 0 ? "Custom / contact sales" : `${plan.currency} ${plan.monthlyPrice}/mo`}
                  </p>

                  {plan.planType !== "TRIAL" && plan.planType !== "FREE" && (
                    <button
                      type="button"
                      onClick={() => void activatePlan(plan.key)}
                      disabled={busyKey === `plan-${plan.key}`}
                      className="mt-4 w-full rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                    >
                      {busyKey === `plan-${plan.key}` ? "Activating…" : "Activate (development)"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {entitlements.status !== "NONE" && (
              <button
                type="button"
                onClick={() => void expirePlan()}
                disabled={busyKey === "expire-plan"}
                className="mt-6 rounded-xl border border-rose-900 bg-rose-950/30 px-4 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-50"
              >
                {busyKey === "expire-plan" ? "Expiring…" : "Expire current plan (development)"}
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default function SubscriptionSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionSettingsContent />
    </Suspense>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function UsageCard({ label, used, max }: { label: string; used: number; max: number }) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (used / max) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-400">{used} / {max}</p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label={`${label} trial usage`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(used, max)}
      >
        <div
          className="h-full rounded-full bg-cyan-400 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
