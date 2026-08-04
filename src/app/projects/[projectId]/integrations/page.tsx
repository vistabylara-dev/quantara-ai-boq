"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { Link2, Plug } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ProjectIntegration = {
  id: string;
  externalConnectionId: string;
  externalProjectId: string | null;
  externalFolderId: string | null;
  externalFileId: string | null;
  externalModelId: string | null;
  syncState: string;
  createdAt: string;
};

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectIntegrationsPage(props: PageProps) {
  const params = use(props.params);
  const [links, setLinks] = useState<ProjectIntegration[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ProjectIntegration[]>(`/api/projects/${params.projectId}/integrations`, signal);
      setLinks(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
          <Link2 className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Project workspace</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Integrations</h1>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-[#536078] dark:text-[#B8C4D8]">
        Link an external project, model, folder, or file to this Quantara project. Connect a provider first from the company Integrations page, then link it here.
      </p>

      {loadError && <p className="mt-4 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>}

      {links && links.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-[#D9E2EC] bg-[#EEF3F8] p-10 text-center dark:border-[#1E2A42] dark:bg-[#111D33]">
          <Plug className="mx-auto h-8 w-8 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-[#0B1630] dark:text-white">No external links yet</p>
          <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            No provider is connected for this company yet, so nothing can be linked to this project.
          </p>
          <Link
            href="/integrations"
            className="mt-4 inline-flex rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
          >
            Browse Integrations
          </Link>
        </div>
      )}

      {links && links.length > 0 && (
        <ul className="mt-6 space-y-3">
          {links.map((link) => (
            <li key={link.id} className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-sm dark:border-[#1E2A42] dark:bg-[#111D33]">
              <p className="font-semibold text-[#0B1630] dark:text-white">{link.externalModelId ?? link.externalFileId ?? link.externalFolderId ?? link.externalProjectId ?? "Linked source"}</p>
              <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Sync state: {link.syncState.replace(/_/g, " ")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
