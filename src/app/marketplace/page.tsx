"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { CATALOGUE_LIBRARIES } from "@/config/libraries";
import ManagedProductsSection from "./managed-products-section";

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
        <h1 className="mt-2 text-3xl font-semibold text-white">Industry data packages</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Full searchable technical libraries by discipline. Buy a package below to unlock it immediately, or contact
          sales for enterprise packages.
        </p>
        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>

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

                  <p className="mt-2 flex-grow text-sm text-slate-400">
                    {product.shortDescription}
                  </p>

                  <div className="mt-5 border-t border-slate-800 pt-4">
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
                    Choose project & hire
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ManagedProductsSection />

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

              <p className="text-sm text-slate-400 mb-4 flex-grow">{lib.description}</p>
              
              {isActive ? (() => {
                // MARKETPLACE-FULL-STRIPE-LINK — pkg.monthlyPrice/annualPrice are the
                // legacy fields (always 0 for every real library package); the price
                // shown and the buy button are driven entirely by the real,
                // Stripe-backed pkg.purchase data, matching the package detail page's
                // already-correct pattern. monthlyPrice/annualPrice are left on the
                // type/API response for anything else that still reads them.
                const monthPrice = pkg.purchase?.prices.find((candidate) => candidate.billingInterval === "MONTH");
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
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">
                          {monthPrice ? `${monthPrice.currency} ${(monthPrice.amountMinor / 100).toLocaleString("en-AE")}/mo` : "Contact sales"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-auto">
                      <Link href={`/marketplace/${pkg.key}`} className="flex-1 text-center rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-2.5 text-xs font-bold text-white">
                        View items
                      </Link>
                      {pkg.hasAccess ? (
                        <span className="flex-1 text-center rounded-xl border border-emerald-900 bg-emerald-950/40 px-3 py-2.5 text-xs font-bold text-emerald-400">
                          Access Granted
                        </span>
                      ) : !monthPrice ? (
                        <span
                          className="flex-1 text-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-400"
                          title="This package has no purchase configured yet."
                        >
                          Contact sales
                        </span>
                      ) : !monthPrice.available ? (
                        <span
                          className="flex-1 text-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-400"
                          title={purchaseUnavailableLabel(monthPrice.unavailableReason)}
                        >
                          {purchaseUnavailableLabel(monthPrice.unavailableReason)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void checkout(monthPrice.priceCode)}
                          disabled={busyKey === monthPrice.priceCode}
                          className="flex-1 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busyKey === monthPrice.priceCode ? "Redirecting…" : "Buy access"}
                        </button>
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
    </div>
  );
}
