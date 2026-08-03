"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type ProposalSummary = {
  id: string;
  revisionNumber: number;
  recipientName: string;
  recipientEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-slate-400",
  READY: "text-blue-300",
  SENT: "text-sky-300",
  OPENED: "text-amber-300",
  COMMENTED: "text-amber-300",
  REVISION_REQUESTED: "text-orange-300",
  APPROVED: "text-emerald-300",
  REJECTED: "text-rose-300",
  REVOKED: "text-slate-500",
  EXPIRED: "text-slate-500",
};

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectClientPreviewPage(props: PageProps) {
  const params = use(props.params);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<ProposalSummary[]>(`/api/projects/${encodeURIComponent(params.projectId)}/proposals`, signal);
      setProposals(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const latest = proposals[0] ?? null;

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client preview</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Client-ready proposals</h2>
      <p className="mt-3 max-w-2xl text-slate-400">
        Client review now happens through secure proposal links, not this page directly. Create a proposal from a locked BOQ
        revision to generate a link the client can open without logging in.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading proposals…</p>}
      {loadError && <p className="mt-6 text-sm text-rose-300">{loadError}</p>}

      {!isLoading && !loadError && (
        <div className="mt-8 space-y-4">
          {latest ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Latest proposal</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">R{String(latest.revisionNumber).padStart(2, "0")} · {latest.recipientName}</p>
                  <p className="text-sm text-slate-400">{latest.recipientEmail} · expires {formatDate(latest.expiresAt)}</p>
                </div>
                <span className={`text-sm font-semibold ${STATUS_COLORS[latest.status] ?? "text-slate-300"}`}>{latest.status}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
              No proposals have been created for this project yet.
            </div>
          )}

          <Link
            href={`/projects/${params.projectId}/proposals`}
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {proposals.length > 0 ? "Manage all proposals" : "Create a proposal"}
          </Link>
        </div>
      )}
    </div>
  );
}
