"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SupplierListResult } from "@/types/supplier";
import { formatDate } from "@/lib/formatting/dates";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function SuppliersPage() {
  const t = useTranslations();
  const [result, setResult] = useState<SupplierListResult | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async (searchValue: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = searchValue.trim() ? `?search=${encodeURIComponent(searchValue.trim())}` : "";
      setResult(await apiClient.get<SupplierListResult>(`/api/suppliers${query}`, signal));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void loadSuppliers(search, controller.signal), 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, loadSuppliers]);

  const suppliers = result?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("suppliers.list.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{t("suppliers.list.title")}</h1>
            <p className="mt-3 text-slate-400">{t("suppliers.list.subtitle")}</p>
          </div>
          <Link
            href="/suppliers/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {t("suppliers.list.newSupplier")}
          </Link>
        </div>
      </div>

      <div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("suppliers.list.searchPlaceholder")}
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {isLoading ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">{t("suppliers.list.loadingTitle")}</p>
          <p className="mt-2 text-sm text-slate-400">{t("suppliers.list.loadingBody")}</p>
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">{t("suppliers.list.unavailableTitle")}</p>
          <p className="mt-2 text-sm text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadSuppliers(search)}
            className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t("suppliers.list.tryAgain")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[32px] border border-slate-800 bg-slate-950">
          <table className="min-w-full text-start text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-6 py-4">{t("suppliers.list.columnSupplier")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnContactPerson")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnEmail")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnPhone")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnCurrency")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnLeadTime")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnStatus")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnUpdated")}</th>
                <th className="px-6 py-4">{t("suppliers.list.columnActions")}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-6 py-4 font-semibold text-white">{supplier.name}</td>
                  <td className="px-6 py-4 text-slate-300">{supplier.contactPerson ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-300">{supplier.email ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-300">{supplier.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-300">{supplier.defaultCurrency}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {supplier.leadTimeDays !== null ? t("suppliers.list.leadTimeDaysCompact", { days: supplier.leadTimeDays }) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        supplier.isActive
                          ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {supplier.isActive ? t("suppliers.list.active") : t("suppliers.list.inactive")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{formatDate(supplier.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      {t("suppliers.list.open")}
                    </Link>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                    {search ? t("suppliers.list.emptySearch") : t("suppliers.list.emptyDefault")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
