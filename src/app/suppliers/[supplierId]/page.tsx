"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import type { SupplierWithCatalogueCount } from "@/types/supplier";
import type { CatalogueListResult } from "@/types/catalogue";
import { formatDate } from "@/lib/formatting/dates";
import { formatCurrency } from "@/lib/formatting/currency";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import SupplierForm from "@/components/suppliers/supplier-form";
import { useTranslations } from "@/lib/i18n/locale-provider";

type PageProps = {
  params: Promise<{ supplierId: string }>;
};

export default function SupplierDetailPage(props: PageProps) {
  const params = use(props.params);
  const t = useTranslations();
  const [supplier, setSupplier] = useState<SupplierWithCatalogueCount | null>(null);
  const [catalogueItems, setCatalogueItems] = useState<CatalogueListResult["items"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [supplierData, catalogueData] = await Promise.all([
        apiClient.get<SupplierWithCatalogueCount>(`/api/suppliers/${params.supplierId}`, signal),
        apiClient.get<CatalogueListResult>(`/api/catalogue?supplierId=${params.supplierId}&pageSize=100`, signal),
      ]);
      setSupplier(supplierData);
      setCatalogueItems(catalogueData.items);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      if (loadError instanceof ApiClientError && loadError.status === 404) {
        setNotFound(true);
      } else {
        setError(getApiErrorMessage(loadError));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.supplierId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleDeactivate = async () => {
    if (!supplier || !supplier.isActive) return;
    if (!window.confirm(t("suppliers.detail.deactivateConfirm", { name: supplier.name }))) return;
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      const updated = await apiClient.delete<{ isActive: boolean }>(`/api/suppliers/${supplier.id}`);
      setSupplier((current) => (current ? { ...current, ...updated } : current));
    } catch (deactivateErr) {
      setDeactivateError(getApiErrorMessage(deactivateErr));
    } finally {
      setIsDeactivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{t("suppliers.detail.loadingTitle")}</p>
        <p className="mt-2 text-sm text-slate-400">{t("suppliers.detail.loadingBody")}</p>
      </div>
    );
  }

  if (notFound || !supplier) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">{error ? t("suppliers.detail.unavailableTitle") : t("suppliers.detail.notFoundTitle")}</p>
        <p className="mt-2 text-sm text-rose-300">{error ?? t("suppliers.detail.notFoundBody")}</p>
        <Link href="/suppliers" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          {t("suppliers.detail.backToSuppliers")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("suppliers.detail.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{supplier.name}</h1>
            {supplier.legalName && <p className="mt-1 text-slate-400">{supplier.legalName}</p>}
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                supplier.isActive
                  ? "border-emerald-800 bg-emerald-950 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              {supplier.isActive ? t("suppliers.detail.active") : t("suppliers.detail.inactive")}
            </span>
          </div>
          <div className="flex gap-3">
            <Link href="/suppliers" className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
              {t("suppliers.detail.backToSuppliers")}
            </Link>
            <button
              type="button"
              onClick={() => setIsEditing((current) => !current)}
              className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {isEditing ? t("suppliers.detail.close") : t("suppliers.detail.edit")}
            </button>
            {supplier.isActive && (
              <button
                type="button"
                onClick={() => void handleDeactivate()}
                disabled={isDeactivating}
                className="inline-flex rounded-2xl border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950 disabled:opacity-60"
              >
                {isDeactivating ? t("suppliers.detail.deactivating") : t("suppliers.detail.deactivate")}
              </button>
            )}
          </div>
        </div>
        {deactivateError && <p className="mt-4 text-sm text-rose-300">{deactivateError}</p>}
      </div>

      {isEditing ? (
        <SupplierForm
          editingSupplier={supplier}
          onSaved={(updated) => {
            setSupplier((current) => (current ? { ...current, ...updated } : current));
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h2 className="text-xl font-semibold text-white">{t("suppliers.detail.contactDetailsTitle")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">{t("suppliers.detail.contactPerson")}</dt><dd className="text-slate-200">{supplier.contactPerson ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.email")}</dt><dd className="text-slate-200">{supplier.email ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.phone")}</dt><dd className="text-slate-200">{supplier.phone ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.website")}</dt><dd className="text-slate-200">{supplier.website ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.address")}</dt><dd className="text-slate-200">{supplier.address ?? "—"}</dd></div>
            </dl>
          </div>
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h2 className="text-xl font-semibold text-white">{t("suppliers.detail.commercialTermsTitle")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">{t("suppliers.detail.taxRegistrationNumber")}</dt><dd className="text-slate-200">{supplier.taxRegistrationNumber ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.defaultCurrency")}</dt><dd className="text-slate-200">{supplier.defaultCurrency}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.paymentTerms")}</dt><dd className="text-slate-200">{supplier.paymentTerms ?? "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.leadTime")}</dt><dd className="text-slate-200">{supplier.leadTimeDays !== null ? t("suppliers.detail.leadTimeDaysFull", { days: supplier.leadTimeDays }) : "—"}</dd></div>
              <div><dt className="text-slate-500">{t("suppliers.detail.catalogueItemCount")}</dt><dd className="text-slate-200">{supplier.catalogueItemCount}</dd></div>
            </dl>
          </div>
        </div>
      )}

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">{t("suppliers.detail.catalogueItemsTitle")}</h2>
        <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-800">
          <table className="min-w-full text-start text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-6 py-4">{t("suppliers.detail.columnCode")}</th>
                <th className="px-6 py-4">{t("suppliers.detail.columnDescription")}</th>
                <th className="px-6 py-4">{t("suppliers.detail.columnSellingRate")}</th>
                <th className="px-6 py-4">{t("suppliers.detail.columnStatus")}</th>
                <th className="px-6 py-4">{t("suppliers.detail.columnAction")}</th>
              </tr>
            </thead>
            <tbody>
              {catalogueItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-6 py-4 font-semibold text-white">{item.itemCode}</td>
                  <td className="px-6 py-4 text-slate-300">{item.description}</td>
                  <td className="px-6 py-4 text-slate-300">{formatCurrency(item.sellingRate, item.currency)}</td>
                  <td className="px-6 py-4 text-slate-300">{item.status}</td>
                  <td className="px-6 py-4">
                    <Link href={`/catalogue?itemId=${item.id}`} className="inline-flex rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                      {t("suppliers.detail.open")}
                    </Link>
                  </td>
                </tr>
              ))}
              {catalogueItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">{t("suppliers.detail.emptyCatalogueItems")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
