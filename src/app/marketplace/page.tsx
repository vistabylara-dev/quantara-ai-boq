"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { CATALOGUE_LIBRARIES } from "@/config/libraries";

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
};

type CommerceProduct = {
  code: string;
  type: string;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: string;
  prices: {
    code: string;
    amountMinor: number;
    currency: string;
    billingInterval: string;
    isFromPrice: boolean;
  }[];
};

export default function MarketplacePage() {
  const [packages, setPackages] = useState<PackageListing[]>([]);
  const [commerceProducts, setCommerceProducts] = useState<CommerceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [data, commerce] = await Promise.all([
        apiClient.get<PackageListing[]>("/api/data-packages", signal),
        apiClient.get<CommerceProduct[]>("/api/commerce/products", signal)
      ]);
      setPackages(data);
      setCommerceProducts(commerce);
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
      const result = await apiClient.post<{ checkoutUrl: string }>("/api/commerce/checkout", { priceCode });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
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

  const enterpriseProducts = commerceProducts.filter((p) => p.type === "SUBSCRIPTION" && p.code.startsWith("enterprise_"));

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Industry data packages</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Full searchable technical libraries by discipline. 
          </p>
          {(actionMessage || actionError) && (
            <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
              {actionError ?? actionMessage}
            </div>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {CATALOGUE_LIBRARIES.map((lib) => {
            const pkg = packages.find((p) => p.key === lib.packageCode);
            const productCode = `industry_${lib.packageCode.replace(/-/g, "_")}`;
            const product = commerceProducts.find((p) => p.code === productCode);
            const isActive = pkg && pkg.itemCount > 0 && product;
            const Icon = lib.icon;

            const monthlyPrice = product?.prices?.find((p) => p.billingInterval === "MONTH");
            const annualPrice = product?.prices?.find((p) => p.billingInterval === "YEAR");

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
                
                {isActive ? (
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
                        {monthlyPrice && <p className="text-sm font-bold text-white">{monthlyPrice.currency} {monthlyPrice.amountMinor / 100}/mo</p>}
                        {annualPrice && <p className="text-xs text-slate-500">{annualPrice.currency} {annualPrice.amountMinor / 100}/yr</p>}
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
                      ) : (
                        <div className="flex gap-2 w-full">
                          {monthlyPrice && (
                            <button
                              type="button"
                              onClick={() => void checkout(monthlyPrice.code)}
                              disabled={!!busyKey}
                              className="flex-1 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {busyKey === monthlyPrice.code ? "Processing..." : "Buy Monthly"}
                            </button>
                          )}
                          {annualPrice && (
                            <button
                              type="button"
                              onClick={() => void checkout(annualPrice.code)}
                              disabled={!!busyKey}
                              className="flex-1 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {busyKey === annualPrice.code ? "Processing..." : "Buy Annual"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
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

      {enterpriseProducts.length > 0 && (
        <div className="space-y-6 pt-12 border-t border-slate-800">
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h2 className="text-2xl font-semibold text-white">Enterprise Plans</h2>
            <p className="mt-2 text-sm text-slate-400">
              Direct checkout available for enterprise subscription tiers.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {enterpriseProducts.map((product) => {
              const annualPrice = product.prices.find((p) => p.billingInterval === "YEAR");
              return (
                <div key={product.code} className="flex flex-col rounded-[32px] border border-amber-900/30 bg-slate-900/80 p-6 text-slate-300 shadow-sm relative">
                  <h3 className="text-xl font-bold text-white">{product.name}</h3>
                  <p className="text-sm text-slate-400 mt-2 flex-grow">{product.shortDescription}</p>
                  {annualPrice && (
                    <div className="mt-6 border-t border-slate-800 pt-4">
                      <p className="text-lg font-bold text-white">{annualPrice.currency} {annualPrice.amountMinor / 100}/year</p>
                      <button
                        type="button"
                        onClick={() => void checkout(annualPrice.code)}
                        disabled={!!busyKey}
                        className="w-full mt-4 rounded-xl border border-amber-600 bg-amber-600 hover:bg-amber-500 transition-colors px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busyKey === annualPrice.code ? "Processing..." : "Subscribe"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
