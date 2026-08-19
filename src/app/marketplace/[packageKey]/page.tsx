"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getLibraryConfigByCode } from "@/config/libraries";
import { useTranslations } from "@/lib/i18n/locale-provider";

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

type PackageDetail = {
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
  hasAccess: boolean;
  purchase: PackagePurchase;
};

type ItemRow = { id: string; itemCode: string; name: string; shortDescription: string; defaultUnit: string; locked?: boolean; packageNames?: string[] };

type PageProps = { params: Promise<{ packageKey: string }> };

export default function MarketplacePackagePage(props: PageProps) {
  const t = useTranslations();
  const params = use(props.params);
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const pkgData = await apiClient.get<PackageDetail>(`/api/data-packages/${params.packageKey}`, signal);
      setPkg(pkgData);
      
      const endpoint = pkgData.hasAccess ? `/api/data-packages/${pkgData.id}/items` : `/api/data-packages/${pkgData.id}/preview`;
      const query = new URLSearchParams({ page: page.toString(), pageSize: "50" });
      if (search) query.set("search", search);
      
      const itemsData = await apiClient.get<{ items: ItemRow[], total: number }>(`${endpoint}?${query.toString()}`, signal);
      setItems(itemsData.items);
      setTotalItems(itemsData.total);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.packageKey, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const checkout = useCallback(async (priceCode: string) => {
    setBusy(true);
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
      setBusy(false);
    }
  }, []);

  function purchaseUnavailableLabel(reason: PackagePurchaseUnavailableReason | null): string {
    switch (reason) {
      case "EXISTING_SUBSCRIPTION":
        return t("marketplaceDetail.alreadySubscribed");
      case "PRICE_NOT_APPROVED":
      case "PROVIDER_MAPPING_MISSING":
      case "PROVIDER_MAPPING_NOT_SYNCED":
        return t("marketplaceDetail.purchaseSetupPending");
      default:
        return t("marketplaceDetail.purchaseUnavailable");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("marketplaceDetail.loadingPackage")}</p>
      </div>
    );
  }

  if (loadError || !pkg) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("marketplaceDetail.unavailable")}</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? t("marketplaceDetail.unavailableFallback")}</p>
      </div>
    );
  }

  const libConfig = getLibraryConfigByCode(pkg.key);
  const Icon = libConfig?.icon;
  const displayName = libConfig?.displayName ?? pkg.name;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href="/marketplace" className="text-xs text-slate-500 hover:text-slate-300">{t("marketplaceDetail.backToMarketplace")}</Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-blue-400 border border-slate-700 shadow-inner">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{pkg.packageType}</p>
                <h1 className="mt-1 text-3xl font-semibold text-white">{displayName}</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-slate-400">{pkg.description}</p>
            <p className="mt-2 text-xs text-slate-500">{t("marketplaceDetail.itemsPublished", { count: pkg.itemCount })}</p>
          </div>
          {pkg.hasAccess ? (
            <span className="inline-flex rounded-2xl border border-emerald-900 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-300">{t("marketplaceDetail.accessGranted")}</span>
          ) : (() => {
            const price = pkg.purchase?.prices.find((candidate) => candidate.billingInterval === "MONTH");
            if (!price) {
              return (
                <span className="inline-flex flex-col items-end gap-1 text-right">
                  <span className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-400">
                    {t("marketplaceDetail.notAvailableForPurchase")}
                  </span>
                </span>
              );
            }
            if (!price.available) {
              return (
                <span
                  className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-400"
                  title={purchaseUnavailableLabel(price.unavailableReason)}
                >
                  {purchaseUnavailableLabel(price.unavailableReason)}
                </span>
              );
            }
            return (
              <div className="inline-flex flex-col items-end gap-2">
                <span className="text-sm font-semibold text-slate-300">
                  {price.currency} {(price.amountMinor / 100).toLocaleString("en-AE")}/{price.billingInterval === "MONTH" ? "mo" : "yr"}
                </span>
                <button
                  type="button"
                  onClick={() => void checkout(price.priceCode)}
                  disabled={busy}
                  className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy ? t("marketplaceDetail.redirecting") : t("marketplaceDetail.buyAccess")}
                </button>
              </div>
            );
          })()}
        </div>
        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{t("marketplaceDetail.sampleItems")}</h2>
            <p className="mt-1 text-sm text-slate-400">{pkg.hasAccess ? t("marketplaceDetail.fullDetailAvailable") : t("marketplaceDetail.previewOnly")}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t("marketplaceDetail.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-white">{item.name}</p>
                {item.locked && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">{t("marketplaceDetail.locked")}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.itemCode} · {item.defaultUnit}</p>
              <p className="mt-1 text-xs text-slate-400">{item.shortDescription}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-500">{t("marketplaceDetail.noItems")}</p>}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500">
            {t("marketplaceDetail.showingItems", { shown: items.length, total: totalItems })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {t("marketplaceDetail.previous")}
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={items.length < 50 || isLoading}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {t("marketplaceDetail.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
