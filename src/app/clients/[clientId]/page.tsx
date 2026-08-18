"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import type { ClientWithProjectCount } from "@/types/client";
import type { Project } from "@/types/project";
import { formatDate } from "@/lib/formatting/dates";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import ClientForm from "@/components/clients/client-form";
import { useTranslations } from "@/lib/i18n/locale-provider";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default function ClientDetailPage(props: PageProps) {
  const params = use(props.params);
  const t = useTranslations();
  const [client, setClient] = useState<ClientWithProjectCount | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [clientData, allProjects] = await Promise.all([
        apiClient.get<ClientWithProjectCount>(`/api/clients/${params.clientId}`, signal),
        apiClient.get<Project[]>("/api/projects", signal),
      ]);
      setClient(clientData);
      setProjects(allProjects.filter((project) => project.clientId === params.clientId));
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
  }, [params.clientId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleArchive = async () => {
    if (!client || client.isArchived) return;
    if (!window.confirm(t("clients.detail.archiveConfirm", { name: client.name }))) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const updated = await apiClient.delete<{ isArchived: boolean; archivedAt: string | null }>(
        `/api/clients/${client.id}`,
      );
      setClient((current) => (current ? { ...current, ...updated } : current));
    } catch (archiveErr) {
      setArchiveError(getApiErrorMessage(archiveErr));
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07111F] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">{t("clients.detail.loadingTitle")}</p>
          <p className="mt-2 text-sm text-slate-400">{t("clients.detail.loadingBody")}</p>
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen bg-[#07111F] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">{error ? t("clients.detail.unavailableTitle") : t("clients.detail.notFoundTitle")}</p>
          <p className="mt-2 text-sm text-rose-300">{error ?? t("clients.detail.notFoundBody")}</p>
          <Link href="/clients" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("clients.detail.backToClients")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111F] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{t("clients.detail.eyebrow")}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{client.name}</h1>
              {client.companyName && <p className="mt-1 text-slate-400">{client.companyName}</p>}
              <span
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  client.isArchived
                    ? "border-slate-700 bg-slate-900 text-slate-400"
                    : "border-emerald-800 bg-emerald-950 text-emerald-300"
                }`}
              >
                {client.isArchived ? t("clients.detail.archived") : t("clients.detail.active")}
              </span>
            </div>
            <div className="flex gap-3">
              <Link href="/clients" className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                {t("clients.detail.backToClients")}
              </Link>
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                {isEditing ? t("clients.detail.close") : t("clients.detail.edit")}
              </button>
              {!client.isArchived && (
                <button
                  type="button"
                  onClick={() => void handleArchive()}
                  disabled={isArchiving}
                  className="inline-flex rounded-2xl border border-rose-800 bg-rose-950/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950 disabled:opacity-60"
                >
                  {isArchiving ? t("clients.detail.archiving") : t("clients.detail.archive")}
                </button>
              )}
            </div>
          </div>
          {archiveError && <p className="mt-4 text-sm text-rose-300">{archiveError}</p>}
        </div>

        {isEditing ? (
          <ClientForm
            editingClient={client}
            onCreated={(updated) => {
              setClient((current) => (current ? { ...current, ...updated } : current));
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
              <h2 className="text-xl font-semibold text-white">{t("clients.detail.contactDetailsTitle")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t("clients.detail.email")}</dt>
                  <dd className="text-slate-200">{client.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.phone")}</dt>
                  <dd className="text-slate-200">{client.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.address")}</dt>
                  <dd className="text-slate-200">{client.address ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.taxRegistrationNumber")}</dt>
                  <dd className="text-slate-200">{client.taxRegistrationNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.notes")}</dt>
                  <dd className="text-slate-200">{client.notes ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
              <h2 className="text-xl font-semibold text-white">{t("clients.detail.recordDetailsTitle")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">{t("clients.detail.projects")}</dt>
                  <dd className="text-slate-200">{client.projectCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.created")}</dt>
                  <dd className="text-slate-200">{formatDate(client.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t("clients.detail.updated")}</dt>
                  <dd className="text-slate-200">{formatDate(client.updatedAt)}</dd>
                </div>
                {client.archivedAt && (
                  <div>
                    <dt className="text-slate-500">{t("clients.detail.archived")}</dt>
                    <dd className="text-slate-200">{formatDate(client.archivedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}

        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">{t("clients.detail.relatedProjectsTitle")}</h2>
          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-800">
            <table className="min-w-full text-start text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-6 py-4">{t("clients.detail.columnProject")}</th>
                  <th className="px-6 py-4">{t("clients.detail.columnStatus")}</th>
                  <th className="px-6 py-4">{t("clients.detail.columnUpdated")}</th>
                  <th className="px-6 py-4">{t("clients.detail.columnAction")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-800 hover:bg-slate-900">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{project.name}</p>
                      <p className="text-xs text-slate-500">{project.reference}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{project.status}</td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(project.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/projects/${project.id}`} className="inline-flex rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                        {t("clients.detail.open")}
                      </Link>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                      {t("clients.detail.emptyProjects")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
