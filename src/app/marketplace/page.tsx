"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { CATALOGUE_LIBRARIES } from "@/config/libraries";
import { MARKETPLACE_CONTENT } from "@/config/marketplace-content";

type PackagePurchaseUnavailableReason =
  | "PRICE_NOT_APPROVED"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_MAPPING_NOT_SYNCED"
  | "EXISTING_SUBSCRIPTION";

type PackagePurchasePrice = {
  priceCode: string;
  billingInterval: "MONTH" | "YEAR";
  amountMinor: number;
  currency: string;
  available: boolean;
  unavailableReason: PackagePurchaseUnavailableReason | null;
};

type PackagePurchase = { available: boolean; prices: PackagePurchasePrice[] } | null;

type PackageListing = {
  id: string;
  key: string;
  name: string;
  description: string;
  disciplineId: string;
  packageType: string;
  itemCount: number;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  isFeatured: boolean;
  hasAccess: boolean;
  purchase: PackagePurchase;
};

function purchaseUnavailableLabel(reason: PackagePurchaseUnavailableReason | null): string {
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

type PublicCommercePrice = {
  code: string;
  amountMinor: number;
  currency: string;
  billingInterval: "ONE_TIME" | "MONTH" | "YEAR";
  isFromPrice: boolean;
};

type CheckoutOptionProduct = {
  productCode: string;
  name: string;
  shortDescription: string;
  prices: {
    priceCode: string;
    amountMinor: number;
    currency: string;
    billingInterval: string;
    available: boolean;
    unavailableReason?: string;
  }[];
};

type CheckoutAvailability = {
  products: CheckoutOptionProduct[];
};

type PublicCommerceProduct = {
  code: string;
  type: string;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: string;
  prices: PublicCommercePrice[];
};

const TAYQAN_PRODUCT_CODES = new Set([
  "tayqan_day",
  "tayqan_week",
  "tayqan_monthly",
]);

export default function MarketplacePage() {
  const [packages, setPackages] = useState<PackageListing[]>([]);

  const [checkoutAvailability, setCheckoutAvailability] = useState<CheckoutAvailability | null>(null);
  const [tayqanCommerceProducts, setTayqanCommerceProducts] =
    useState<PublicCommerceProduct[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data =
        await apiClient.get<PackageListing[]>(
          "/api/data-packages",
          signal,
        );

      setPackages(data);
      try {
        const availability = await apiClient.get<CheckoutAvailability>("/api/commerce/checkout-options", signal);
        setCheckoutAvailability(availability);
      } catch (e) {
        console.error("Failed to load checkout options", e);
      }

      // TAYQAN is a normal public CommerceProduct.
      // Failure of the commerce catalogue must never
      // break the existing Industry Library marketplace.
      try {
        const commerce =
          await apiClient.get<PublicCommerceProduct[]>(
            "/api/commerce/products",
            signal,
          );

        setTayqanCommerceProducts(
          commerce.filter((product) =>
            TAYQAN_PRODUCT_CODES.has(product.code),
          ),
        );
      }
      catch (commerceError) {
        if (
          commerceError instanceof DOMException
          && commerceError.name === "AbortError"
        ) {
          return;
        }

        setTayqanCommerceProducts([]);
      }
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

  const checkout = useCallback(async (priceCode: string) => {
    setBusyKey(priceCode);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await apiClient.post<{ checkoutUrl: string; checkoutSessionId: string }>(
        "/api/commerce/checkout",
        { priceCode },
      );
      window.location.href = result.checkoutUrl;
    } catch (error) {
      setActionError(getApiErrorMessage(error));
      setBusyKey(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading marketplace</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Marketplace unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Marketplace</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{MARKETPLACE_CONTENT.intro.headline}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          {MARKETPLACE_CONTENT.intro.subheadline}
        </p>

        <div className="mt-6 space-y-2 text-sm text-slate-400">
          <ul className="list-disc pl-5 space-y-1.5">
            {MARKETPLACE_CONTENT.intro.points.map((pt, i) => <li key={i}>{pt}</li>)}
          </ul>
          <p className="mt-4 pt-4 font-semibold text-white">{MARKETPLACE_CONTENT.intro.closing}</p>
          <div className="mt-4 space-y-1.5 text-slate-400">
            {MARKETPLACE_CONTENT.intro.explanation.map((pt, i) => <p key={i}>{pt}</p>)}
          </div>
        </div>

        {(actionMessage || actionError) && (
          <div className={`mt-6 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>


      {checkoutAvailability && (
        <>
          <section className="mb-16">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
              Core Software
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {checkoutAvailability.products
                .filter(p => ["starter", "professional", "business"].includes(p.productCode))
                .sort((a, b) => {
                  const order = { starter: 0, professional: 1, business: 2 } as any;
                  return order[a.productCode] - order[b.productCode];
                })
                .map(plan => {
                  const monthPrice = plan.prices.find(p => p.billingInterval === "MONTH");
                  const yearPrice = plan.prices.find(p => p.billingInterval === "YEAR");
                  if (!monthPrice && !yearPrice) return null;
                  return (
                    <div key={plan.productCode} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
                      <h3 className="text-lg font-bold text-white capitalize">{plan.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">{plan.shortDescription}</p>

                      <details className="group mt-4 flex-grow border-t border-slate-800 pt-4 mb-4">
                        <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
                          View package details
                        </summary>
                        <div className="mt-4 space-y-3 text-sm text-slate-400 pb-2">
                          {(() => {
                            const pContent = MARKETPLACE_CONTENT.plans[plan.productCode as keyof typeof MARKETPLACE_CONTENT.plans];
                            if (!pContent) return null;
                            return (
                              <>
                                <div><strong className="text-slate-300">Best for:</strong> {pContent.bestFor}</div>
                                <div><strong className="text-slate-300">Purpose:</strong> {pContent.purpose}</div>
                                <div><strong className="text-slate-300">Why choose:</strong> {pContent.whyChoose}</div>
                              </>
                            );
                          })()}
                        </div>
                      </details>

                      <div className="mt-auto flex flex-col gap-4">
                        {monthPrice && (
                          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                            <p className="text-2xl font-semibold text-white">
                              {monthPrice.currency} {(monthPrice.amountMinor / 100).toLocaleString("en-AE")}
                              <span className="text-sm font-normal text-slate-500">/mo</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => checkout(monthPrice.priceCode)}
                              disabled={busyKey === monthPrice.priceCode || !monthPrice.available}
                              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {busyKey === monthPrice.priceCode ? "Redirecting..." : monthPrice.available ? "Buy Monthly" : purchaseUnavailableLabel(monthPrice.unavailableReason as any)}
                            </button>
                          </div>
                        )}
                        {yearPrice && (
                          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                            <p className="text-2xl font-semibold text-white">
                              {yearPrice.currency} {(yearPrice.amountMinor / 100).toLocaleString("en-AE")}
                              <span className="text-sm font-normal text-slate-500">/yr</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => checkout(yearPrice.priceCode)}
                              disabled={busyKey === yearPrice.priceCode || !yearPrice.available}
                              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {busyKey === yearPrice.priceCode ? "Redirecting..." : yearPrice.available ? "Buy Annual" : purchaseUnavailableLabel(yearPrice.unavailableReason as any)}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="mb-16">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M3 21h18"/><path d="M19 21v-4"/><path d="M19 17a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M14 15V7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v8"/><path d="M10 9h2"/></svg>
              Enterprise
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {checkoutAvailability.products
                .filter(p => ["enterprise_core", "enterprise_scale", "enterprise_authority"].includes(p.productCode))
                .sort((a, b) => {
                  const order = { enterprise_core: 0, enterprise_scale: 1, enterprise_authority: 2 } as any;
                  return order[a.productCode] - order[b.productCode];
                })
                .map(plan => {
                  const price = plan.prices.find(p => p.billingInterval === "YEAR") || plan.prices[0];
                  if (!price) return null;
                  return (
                    <div key={plan.productCode} className="flex flex-col rounded-2xl border border-purple-900/30 bg-slate-900 p-6 text-slate-300">
                      <h3 className="text-lg font-bold text-purple-400 capitalize">{plan.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">{plan.shortDescription}</p>

                      <details className="group mt-4 flex-grow border-t border-slate-800 pt-4 mb-4">
                        <summary className="cursor-pointer text-sm font-semibold text-purple-400 hover:text-purple-300">
                          View package details
                        </summary>
                        <div className="mt-4 space-y-4 text-sm text-slate-400 pb-2">
                          {(() => {
                            const pContent = MARKETPLACE_CONTENT.enterprise[plan.productCode as keyof typeof MARKETPLACE_CONTENT.enterprise];
                            if (!pContent) return null;
                            return (
                              <>
                                <div><strong className="text-purple-300">{pContent.position}</strong></div>
                                {pContent.bestFor && <div><strong className="text-slate-300">Best for:</strong> {pContent.bestFor}</div>}
                                <div>
                                  <strong className="text-slate-300">Includes:</strong>
                                  <ul className="list-disc pl-5 mt-1 space-y-1">
                                    {pContent.includes.map((inc, i) => <li key={i}>{inc}</li>)}
                                  </ul>
                                </div>
                                <div className="italic text-slate-300 whitespace-pre-line">{pContent.keyMessage}</div>
                              </>
                            );
                          })()}
                        </div>
                      </details>

                      <div className="mt-auto border-t border-slate-800 pt-6">
                        <p className="text-2xl font-semibold text-white">
                          {price.currency} {(price.amountMinor / 100).toLocaleString("en-AE")}
                          <span className="text-sm font-normal text-slate-500">/yr</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkout(price.priceCode)}
                        disabled={busyKey === price.priceCode || !price.available}
                        className="mt-6 rounded-xl border border-purple-600 bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                      >
                        {busyKey === price.priceCode ? "Redirecting..." : price.available ? (MARKETPLACE_CONTENT.enterprise[plan.productCode as keyof typeof MARKETPLACE_CONTENT.enterprise]?.cta || "Buy enterprise") : purchaseUnavailableLabel(price.unavailableReason as any)}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="mt-12 overflow-x-auto rounded-[24px] border border-slate-800 bg-slate-900/50">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Capability</th>
                    <th className="px-6 py-4 font-semibold">Core</th>
                    <th className="px-6 py-4 font-semibold">Scale</th>
                    <th className="px-6 py-4 font-semibold">Authority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr><td className="px-6 py-4">Manual BOQ</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td></tr>
                  <tr><td className="px-6 py-4">Company Item Library</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td></tr>
                  <tr><td className="px-6 py-4">Manual Quantity/Rate</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td></tr>
                  <tr><td className="px-6 py-4">Professional Outputs</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td><td className="px-6 py-4">✓</td></tr>
                  <tr><td className="px-6 py-4">AI Draft BOQ</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4 text-purple-400">✓</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">AI-Assisted Workflow</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4 text-purple-400">✓</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">Voice-Assisted Workflow</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4 text-purple-400">✓</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">Google Drive</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4 text-purple-400">✓</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">Autodesk/AutoCAD</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4 text-purple-400">✓</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">API / Company Workflows</td><td className="px-6 py-4 text-slate-500">—</td><td className="px-6 py-4">Selected</td><td className="px-6 py-4 text-purple-400">✓</td></tr>
                  <tr><td className="px-6 py-4">Governance</td><td className="px-6 py-4">Basic</td><td className="px-6 py-4">Advanced</td><td className="px-6 py-4 text-purple-400">Full</td></tr>
                  <tr><td className="px-6 py-4">Specialist Libraries</td><td className="px-6 py-4 text-slate-400 text-xs">Purchased separately</td><td className="px-6 py-4 text-slate-400 text-xs">Purchased separately</td><td className="px-6 py-4 text-purple-300 font-medium">Contracted entitlement</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tayqanCommerceProducts.length > 0 && (
        <section className="rounded-[32px] border border-cyan-900 bg-slate-950 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
              AI Workforce
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Hire TAYQAN — AI Quantity Surveyor
            </h2>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Choose a hire package, then select the project where TAYQAN should work.
              Payment uses Quantara&apos;s approved commerce and Stripe infrastructure.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {tayqanCommerceProducts.map((product) => {
              const price = product.prices[0];

              if (!price) return null;

              const badge =
                product.code === "tayqan_week"
                  ? "Most Popular"
                  : product.code === "tayqan_monthly"
                    ? "Digital QS"
                    : null;

              const duration =
                product.code === "tayqan_day"
                  ? "24 hours"
                  : product.code === "tayqan_week"
                    ? "7 days"
                    : "Monthly";

              return (
                <div
                  key={product.code}
                  className="relative flex flex-col rounded-[28px] border border-cyan-900/70 bg-cyan-950/10 p-5"
                >
                  {badge && (
                    <span className="mb-3 w-fit rounded-full border border-cyan-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                      {badge}
                    </span>
                  )}

                  <h3 className="text-lg font-bold text-white">
                    {product.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    {product.shortDescription}
                  </p>

                  <details className="group mt-3 flex-grow border-t border-cyan-900/40 pt-3 mb-2">
                    <summary className="cursor-pointer text-sm font-semibold text-cyan-400 hover:text-cyan-300">
                      View package details
                    </summary>
                    <div className="mt-3 space-y-2 text-sm text-slate-400 pb-2">
                      {(() => {
                        const tContent = MARKETPLACE_CONTENT.tayqan[product.code as keyof typeof MARKETPLACE_CONTENT.tayqan];
                        if (!tContent) return null;
                        return (
                          <>
                            <div><strong className="text-cyan-300">{tContent.position}</strong></div>
                            <div><strong className="text-slate-300">Best for:</strong> {tContent.bestFor}</div>
                          </>
                        );
                      })()}
                    </div>
                  </details>

                  <div className="mt-auto border-t border-slate-800 pt-4">
                    <p className="text-2xl font-semibold text-white">
                      {price.currency}{" "}
                      {(price.amountMinor / 100).toLocaleString("en-AE")}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {duration}
                      {price.billingInterval === "MONTH"
                        ? " · recurring monthly"
                        : " · one-time hire"}
                    </p>

                    {product.code === "tayqan_day" && (
                      <p className="mt-2 text-xs font-semibold text-cyan-300">
                        Up to 2 distinct projects per 24-hour hire
                      </p>
                    )}
                  </div>

                  <Link
                    href="/projects?tayqan=assign"
                    className="mt-5 rounded-xl border border-cyan-600 bg-cyan-600 px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-cyan-500"
                  >
                    {MARKETPLACE_CONTENT.tayqan[product.code as keyof typeof MARKETPLACE_CONTENT.tayqan]?.cta || "Choose project & hire"}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-8 rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-2xl font-bold text-white">{MARKETPLACE_CONTENT.librariesIntro.headline}</h2>
          <p className="mt-3 max-w-2xl text-base text-slate-300">{MARKETPLACE_CONTENT.librariesIntro.subheadline}</p>
          <div className="mt-4 rounded-xl bg-blue-950/20 border border-blue-900/30 p-4">
            <p className="text-sm text-blue-300 font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              {MARKETPLACE_CONTENT.librariesIntro.explanation}
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {CATALOGUE_LIBRARIES.map((lib) => {
          const pkg = packages.find((p) => p.key === lib.packageCode);
          const isActive = pkg && pkg.itemCount > 0;
          const Icon = lib.icon;

          return (
            <div key={lib.key} className="flex flex-col rounded-[32px] border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition-colors p-6 text-slate-300 shadow-sm relative overflow-hidden group">

              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-inner group-hover:scale-105 transition-transform ${isActive ? 'bg-slate-800 text-blue-400 border-slate-700' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold tracking-tight leading-tight mt-1 ${isActive ? 'text-white' : 'text-slate-500'}`}>{lib.displayName}</h3>
                  </div>
                </div>
                {isActive && pkg?.isFeatured && <span className="absolute top-6 right-6 rounded-full bg-blue-900/40 border border-blue-800/50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-blue-300">Featured</span>}
              </div>

              <p className="text-sm text-slate-400 mb-2">{lib.description}</p>

              <details className="group mt-2 mb-4 flex-grow border-t border-slate-800/60 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
                  View library details
                </summary>
                <div className="mt-3 space-y-3 text-sm text-slate-400 pb-2">
                  {(() => {
                    const lContent = MARKETPLACE_CONTENT.libraries[lib.key as keyof typeof MARKETPLACE_CONTENT.libraries] as any;
                    if (!lContent) return null;
                    return (
                      <>
                        {lContent.bestFor && <div><strong className="text-slate-300">Best for:</strong> {lContent.bestFor}</div>}
                        {lContent.usefulFor && <div><strong className="text-slate-300">Useful for:</strong> {lContent.usefulFor}</div>}
                        {lContent.value && <div><strong className="text-slate-300">Why add this library?</strong><br/>{lContent.value}</div>}
                        {lContent.important && <div className="rounded border border-amber-900/50 bg-amber-950/20 p-2 text-xs text-amber-200">{lContent.important}</div>}
                        {lContent.disclaimer && <div className="rounded border border-amber-900/50 bg-amber-950/20 p-2 text-xs text-amber-200">{lContent.disclaimer}</div>}

                        <div className="mt-4 border-t border-slate-800/60 pt-3">
                          <strong className="text-slate-300">{MARKETPLACE_CONTENT.libraryPostPurchase.headline}</strong>
                          <p className="mt-1 whitespace-pre-line text-xs">{MARKETPLACE_CONTENT.libraryPostPurchase.explanation}</p>
                          <div className="mt-2 rounded bg-slate-800/40 p-2 text-xs">
                            <strong className="text-amber-200/90 block mb-1">{MARKETPLACE_CONTENT.libraryPostPurchase.important}</strong>
                            <strong className="text-slate-300 block mb-1">{MARKETPLACE_CONTENT.libraryPostPurchase.checklistTitle}</strong>
                            <ul className="list-disc pl-4 grid grid-cols-2 gap-x-2">
                              {MARKETPLACE_CONTENT.libraryPostPurchase.checklist.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </details>

              {isActive ? (() => {
                const monthPrice = pkg.purchase?.prices.find((candidate) => candidate.billingInterval === "MONTH");
                const yearPrice = pkg.purchase?.prices.find((candidate) => candidate.billingInterval === "YEAR");
                return (
                  <>
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-950/20 border border-blue-900/30 p-2.5 text-xs text-blue-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-400"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      <span className="font-medium">Provides BOQ autocomplete benefits</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800 pt-4 mb-5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                        {pkg.itemCount.toLocaleString()} items
                      </div>
                      <div className="text-right flex flex-col items-end gap-0.5">
                        {monthPrice ? (
                          <p className="text-sm font-bold text-white">
                            {monthPrice.currency} {(monthPrice.amountMinor / 100).toLocaleString("en-AE")} <span className="text-xs font-normal text-slate-400">/mo</span>
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-white">Contact sales</p>
                        )}
                        {yearPrice && (
                          <p className="text-sm font-bold text-white">
                            {yearPrice.currency} {(yearPrice.amountMinor / 100).toLocaleString("en-AE")} <span className="text-xs font-normal text-slate-400">/yr</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-auto">
                      <Link href={`/marketplace/${pkg.key}`} className="w-full text-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2.5 text-xs font-bold text-white mb-2">
                        View items
                      </Link>
                      {pkg.hasAccess ? (
                        <span className="w-full text-center rounded-xl border border-emerald-900 bg-emerald-950/40 px-3 py-2.5 text-xs font-bold text-emerald-400">
                          Access Granted
                        </span>
                      ) : !monthPrice && !yearPrice ? (
                        <span
                          className="w-full text-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-400"
                          title="This package has no purchase configured yet."
                        >
                          Contact sales
                        </span>
                      ) : (
                        <div className="flex w-full gap-2">
                          {monthPrice && (
                            <button
                              type="button"
                              onClick={() => void checkout(monthPrice.priceCode)}
                              disabled={busyKey === monthPrice.priceCode || !monthPrice.available}
                              className="flex-1 rounded-xl border border-slate-600 bg-slate-700 hover:bg-slate-600 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                              title={!monthPrice.available ? purchaseUnavailableLabel(monthPrice.unavailableReason as any) : undefined}
                            >
                              {busyKey === monthPrice.priceCode ? "..." : monthPrice.available ? ((MARKETPLACE_CONTENT.libraries[lib.key as keyof typeof MARKETPLACE_CONTENT.libraries] as any)?.cta + " (Mo)" || "Buy Monthly") : "Setup pending"}
                            </button>
                          )}
                          {yearPrice && (
                            <button
                              type="button"
                              onClick={() => void checkout(yearPrice.priceCode)}
                              disabled={busyKey === yearPrice.priceCode || !yearPrice.available}
                              className="flex-1 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                              title={!yearPrice.available ? purchaseUnavailableLabel(yearPrice.unavailableReason as any) : undefined}
                            >
                              {busyKey === yearPrice.priceCode ? "..." : yearPrice.available ? ((MARKETPLACE_CONTENT.libraries[lib.key as keyof typeof MARKETPLACE_CONTENT.libraries] as any)?.cta + (monthPrice ? " (Yr)" : "") || "Buy Annual") : "Setup pending"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })() : (
                <div className="flex flex-col mt-auto border-t border-slate-800 pt-4">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 border border-slate-800 p-2.5 text-xs text-slate-400 justify-center">
                    <span className="font-medium">{pkg ? "Data Activation Pending" : "Coming Soon"}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </section>
    </div>
  );
}

