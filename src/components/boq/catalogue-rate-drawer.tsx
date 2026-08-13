"use client";

import { useEffect, useState } from "react";
import type { CatalogueItem, CatalogueListResult, CatalogueStatus } from "@/types/catalogue";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";

const CATALOGUE_STATUS_TRANSLATION_KEYS: Record<CatalogueStatus, TranslationKey> = {
  ACTIVE: "catalogue.statusActive",
  PENDING: "catalogue.statusPending",
  EXPIRED: "catalogue.statusExpired",
  INACTIVE: "catalogue.statusInactive",
};

type CatalogueRateDrawerProps = {
  industryId: string;
  onSelect: (item: CatalogueItem) => void;
  onClose: () => void;
};

export default function CatalogueRateDrawer({ industryId, onSelect, onClose }: CatalogueRateDrawerProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setIsLoading(true);
      const params = new URLSearchParams({ industryEngineId: industryId, pageSize: "100" });
      if (search.trim()) params.set("search", search.trim());
      apiClient
        .get<CatalogueListResult>(`/api/catalogue?${params.toString()}`, controller.signal)
        .then((result) => setItems(result.items))
        .catch(() => undefined)
        .finally(() => setIsLoading(false));
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [industryId, search]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t("boqEditor.applyCatalogueRateTitle")}</h3>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            {t("common.close")}
          </button>
        </div>
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("boqEditor.searchCataloguePlaceholder")}
          className="mb-4 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
        />
        {isLoading && <p className="text-sm text-slate-400">{t("boqEditor.loadingCatalogueRates")}</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-slate-400">{t("boqEditor.noCatalogueRatesFound")}</p>
        )}
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{item.itemCode} — {item.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.supplierName ?? t("boqEditor.noSupplier")} · {item.category}
                    {item.expiryDate && <> · {t("boqEditor.expiresOn", { date: formatDate(item.expiryDate) })}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatCurrency(item.sellingRate, item.currency)}</p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.status === "ACTIVE"
                        ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                        : item.status === "EXPIRED"
                          ? "border-rose-800 bg-rose-950 text-rose-300"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                    }`}
                  >
                    {t(CATALOGUE_STATUS_TRANSLATION_KEYS[item.status])}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
