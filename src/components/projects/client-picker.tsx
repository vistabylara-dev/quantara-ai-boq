"use client";

import { useEffect, useRef, useState } from "react";
import type { Client, ClientListResult } from "@/types/client";
import { apiClient } from "@/lib/api/client";
import ClientForm from "@/components/clients/client-form";
import { useTranslations } from "@/lib/i18n/locale-provider";

type ClientPickerProps = {
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
};

export default function ClientPicker({ selectedClient, onSelect }: ClientPickerProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      apiClient
        .get<ClientListResult>(`/api/clients${query}`, controller.signal)
        .then((result) => setResults(result.items))
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <span className="text-sm text-slate-400">{t("projects.clientPicker.label")}</span>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-start text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        <span className={selectedClient ? "text-white" : "text-slate-500"}>
          {selectedClient ? (selectedClient.companyName ?? selectedClient.name) : t("projects.clientPicker.placeholder")}
        </span>
        <span className="text-slate-500">▾</span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-xl">
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("projects.clientPicker.searchPlaceholder")}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {results.length === 0 && (
              <p className="px-2 py-3 text-sm text-slate-500">{t("projects.clientPicker.noMatches")}</p>
            )}
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  onSelect(client);
                  setIsOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-2 text-start text-sm text-slate-200 hover:bg-slate-900"
              >
                <span className="font-semibold text-white">{client.name}</span>
                {client.companyName && <span className="text-slate-400"> · {client.companyName}</span>}
                {client.email && <span className="block text-xs text-slate-500">{client.email}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setIsOpen(false);
            }}
            className="mt-2 w-full rounded-xl border border-dashed border-slate-700 px-3 py-2 text-sm text-blue-400 hover:bg-slate-900"
          >
            + {t("projects.clientPicker.createNewClient")}
          </button>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">{t("projects.clientPicker.createClientTitle")}</h3>
            <ClientForm
              compact
              submitLabel={t("projects.clientPicker.createAndSelect")}
              onCancel={() => setIsCreating(false)}
              onCreated={(client) => {
                onSelect(client);
                setIsCreating(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
