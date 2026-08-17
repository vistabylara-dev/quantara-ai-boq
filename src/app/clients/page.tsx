"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ClientListResult } from "@/types/client";
import { formatDate } from "@/lib/formatting/dates";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

export default function ClientsPage() {
  const t = useTranslations();
  const [result, setResult] = useState<ClientListResult | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async (searchValue: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = searchValue.trim() ? `?search=${encodeURIComponent(searchValue.trim())}` : "";
      setResult(await apiClient.get<ClientListResult>(`/api/clients${query}`, signal));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void loadClients(search, controller.signal), 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, loadClients]);

  const clients = result?.items ?? [];

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{t("clients.list.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{t("clients.list.title")}</h1>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            {t("clients.list.newClient")}
          </Link>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("clients.list.searchPlaceholder")}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {isLoading ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">{t("clients.list.loadingTitle")}</p>
            <p className="mt-2 text-sm text-slate-400">{t("clients.list.loadingBody")}</p>
          </div>
        ) : error ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">{t("clients.list.unavailableTitle")}</p>
            <p className="mt-2 text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadClients(search)}
              className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {t("clients.list.tryAgain")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[32px] border border-slate-800 bg-slate-950">
            <table className="min-w-full text-start text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-6 py-4">{t("clients.list.columnClient")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnCompany")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnEmail")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnPhone")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnStatus")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnUpdated")}</th>
                  <th className="px-6 py-4">{t("clients.list.columnActions")}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-800 hover:bg-slate-900">
                    <td className="px-6 py-4 font-semibold text-white">{client.name}</td>
                    <td className="px-6 py-4 text-slate-300">{client.companyName ?? "—"}</td>
                    <td className="px-6 py-4 text-slate-300">{client.email ?? "—"}</td>
                    <td className="px-6 py-4 text-slate-300">{client.phone ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          client.isArchived
                            ? "border-slate-700 bg-slate-900 text-slate-400"
                            : "border-emerald-800 bg-emerald-950 text-emerald-300"
                        }`}
                      >
                        {client.isArchived ? t("clients.list.archived") : t("clients.list.active")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(client.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/clients/${client.id}`}
                        className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        {t("clients.list.open")}
                      </Link>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      {search ? t("clients.list.emptySearch") : t("clients.list.emptyDefault")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
