"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ClientListResult } from "@/types/client";
import { formatDate } from "@/lib/formatting/dates";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

export default function ClientsPage() {
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
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Clients</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Client directory</h1>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            New client
          </Link>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, company, email, or phone"
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {isLoading ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">Loading clients</p>
            <p className="mt-2 text-sm text-slate-400">Fetching the company client directory...</p>
          </div>
        ) : error ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">Clients unavailable</p>
            <p className="mt-2 text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadClients(search)}
              className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[32px] border border-slate-800 bg-slate-950">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4">Actions</th>
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
                        {client.isArchived ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(client.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/clients/${client.id}`}
                        className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                      {search
                        ? "No clients match this search."
                        : "No clients yet. Use New client to add the first contact."}
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
