"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";

type ProjectView = {
  id: string;
  name: string;
  slug?: string;
};

type BoqItemView = { id: string };

type BoqSectionView = {
  id: string;
  code: string;
  title: string;
  items: BoqItemView[];
};

type BoqView = {
  id: string;
  revision: string;
  status: "draft" | "locked" | "approved";
  sections: BoqSectionView[];
};

type ExtractedEntityView = {
  id: string;
  projectId: string;
  projectFileId: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  extractionMethod: string;
  sourceText: string | null;
  status: string;
};

type AddItemResult = {
  item: { id: string };
  boq: BoqView;
};

const DRAFT_ELIGIBLE_STATUSES = new Set([
  "EXTRACTED",
  "NEEDS_REVIEW",
  "CONFIRMED",
  "CORRECTED",
]);

function isUsableSampleCandidate(entity: ExtractedEntityView): boolean {
  return (
    DRAFT_ELIGIBLE_STATUSES.has(entity.status)
    && entity.label.trim().length > 0
    && entity.quantity !== null
    && Number.isFinite(entity.quantity)
    && entity.quantity > 0
    && Boolean(entity.unit?.trim())
  );
}

function totalBoqItems(boq: BoqView): number {
  return boq.sections.reduce((total, section) => total + section.items.length, 0);
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeText(value: string | null, maximum: number): string {
  return (value ?? "").trim().slice(0, maximum);
}

export default function AdminSampleBoqPage(props: {
  params: Promise<{ projectId: string }>;
}) {
  const params = use(props.params);
  const encodedProjectId = encodeURIComponent(params.projectId);

  const [project, setProject] = useState<ProjectView | null>(null);
  const [boqs, setBoqs] = useState<BoqView[]>([]);
  const [entities, setEntities] = useState<ExtractedEntityView[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, boqData, extractionData] = await Promise.all([
        apiClient.get<ProjectView>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<BoqView[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
        apiClient.get<ExtractedEntityView[]>(`/api/projects/${encodedProjectId}/extractions`, signal),
      ]);
      setProject(projectData);
      setBoqs(boqData);
      setEntities(extractionData);
      setSelectedIds(new Set(extractionData.filter(isUsableSampleCandidate).map((entity) => entity.id)));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [encodedProjectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const usableEntities = useMemo(
    () => entities.filter(isUsableSampleCandidate),
    [entities],
  );

  const visibleEntities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return usableEntities;
    return usableEntities.filter((entity) =>
      [entity.label, entity.entityType, entity.unit ?? "", entity.extractionMethod]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, usableEntities]);

  const selectedEntities = useMemo(
    () => usableEntities.filter((entity) => selectedIds.has(entity.id)),
    [selectedIds, usableEntities],
  );

  const ignoredCount = Math.max(0, usableEntities.length - selectedEntities.length);
  const existingItemCount = useMemo(
    () => boqs.reduce((total, boq) => total + totalBoqItems(boq), 0),
    [boqs],
  );

  function toggleEntity(entityId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
    setError(null);
    setMessage(null);
  }

  function selectOnly(entityId: string) {
    setSelectedIds(new Set([entityId]));
    setError(null);
    setMessage("All other usable candidates are ignored for this admin sample only.");
  }

  function selectAllUsable() {
    setSelectedIds(new Set(usableEntities.map((entity) => entity.id)));
    setError(null);
    setMessage("All usable candidates are included in the admin sample selection.");
  }

  function bulkIgnoreAll() {
    setSelectedIds(new Set());
    setError(null);
    setMessage("All extracted candidates are ignored for this admin sample only. Nothing was rejected or changed in extraction evidence.");
  }

  async function ensureEmptyEditableBoq(): Promise<BoqView> {
    if (existingItemCount > 0) {
      throw new Error(
        "Safety stop: this project already contains BOQ items. The admin one-item sample tool will not delete, overwrite, or mix with an existing BOQ. Use an empty admin test project for an exact one-item acceptance test.",
      );
    }

    let target = boqs.find((boq) => boq.status === "draft") ?? null;

    if (!target && boqs.length === 0) {
      target = await apiClient.post<BoqView>(
        `/api/projects/${encodedProjectId}/boqs`,
        {
          title: "Admin Sample BOQ",
          sections: [
            {
              code: "ADMIN-SAMPLE",
              title: "Admin Sample",
              description: "Admin-only one-item acceptance BOQ.",
              order: 1,
            },
          ],
        },
      );
    } else if (!target) {
      const latest = boqs[0];
      if (!latest) throw new Error("No BOQ revision is available.");
      target = await apiClient.post<BoqView>(
        `/api/boqs/${encodeURIComponent(latest.id)}/revisions`,
        {},
      );
    }

    if (totalBoqItems(target) > 0) {
      throw new Error(
        "Safety stop: the editable BOQ is not empty. No existing BOQ items were changed.",
      );
    }

    if (target.sections.length === 0) {
      target = await apiClient.post<BoqView>(
        `/api/boqs/${encodeURIComponent(target.id)}/sections`,
        {
          code: "ADMIN-SAMPLE",
          title: "Admin Sample",
          description: "Admin-only one-item acceptance BOQ.",
          sortOrder: 1,
        },
      );
    }

    if (!target.sections[0]) {
      throw new Error("The sample BOQ has no section available for the test item.");
    }

    return target;
  }

  async function generateOneItemDraft() {
    if (isGenerating) return;
    if (selectedEntities.length !== 1) {
      setError("Select exactly one usable extracted item before generating the admin sample BOQ.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const selected = selectedEntities[0];
      const target = await ensureEmptyEditableBoq();
      const section = target.sections[0];
      if (!section) throw new Error("The sample BOQ section is unavailable.");

      const itemCode = `ADM-${selected.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const result = await apiClient.post<AddItemResult>(
        `/api/boqs/${encodeURIComponent(target.id)}/items/from-source`,
        {
          sourceType: "IMPORT",
          sectionId: section.id,
          itemNumber: 1,
          quantity: String(selected.quantity),
          sortOrder: 1,
          drawingReference: `EXTRACTED_ENTITY:${selected.id}`,
          overrides: {
            itemCode,
            category: formatLabel(selected.entityType).slice(0, 255) || "Admin Sample",
            description: selected.label.trim().slice(0, 2_000),
            specification: safeText(selected.sourceText, 2_000),
            unit: selected.unit?.trim().slice(0, 50),
            unitCost: 0,
            marginMode: "MARKUP",
            marginPercentage: 0,
          },
        },
      );

      if (totalBoqItems(result.boq) !== 1) {
        throw new Error(
          `Acceptance failed safely: expected exactly 1 BOQ item but found ${totalBoqItems(result.boq)}. Review the BOQ before continuing.`,
        );
      }

      setMessage("Success: exactly one extracted item was added to the draft BOQ. Other extraction candidates were left unchanged.");
      window.location.assign(
        `/projects/${encodedProjectId}/boq?adminSample=1&added=1`,
      );
    } catch (generateError) {
      setError(
        generateError instanceof ApiClientError
          ? generateError.message
          : generateError instanceof Error
            ? generateError.message
            : "The admin sample BOQ could not be generated.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#050914] p-6 text-white md:p-10">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-slate-800 bg-slate-950 p-8">
          <p className="text-sm text-slate-400">Loading admin sample BOQ tool…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050914] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-cyan-800/50 bg-slate-950 p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Platform owner · admin acceptance tool</p>
              <h1 className="mt-2 text-3xl font-black">One-item Sample BOQ</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                {project?.name ?? params.projectId}: choose exactly one usable extraction, ignore all others for this sample, and create an editable one-item draft BOQ using Quantara&apos;s existing BOQ APIs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${encodedProjectId}/extractions`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
              >
                Open extraction review
              </Link>
              <Link
                href={`/projects/${encodedProjectId}/documents`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900"
              >
                Open documents
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl font-black">{entities.length}</p>
              <p className="mt-1 text-xs text-slate-400">All extracted</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl font-black text-emerald-300">{usableEntities.length}</p>
              <p className="mt-1 text-xs text-slate-400">Usable for sample</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl font-black text-cyan-300">{selectedEntities.length}</p>
              <p className="mt-1 text-xs text-slate-400">Selected</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl font-black text-amber-300">{ignoredCount}</p>
              <p className="mt-1 text-xs text-slate-400">Ignored for this sample</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
            <strong>Non-destructive:</strong> “Ignore” here is local to this admin sample. It does not call Reject, does not change extraction status, and does not modify ignored evidence.
          </div>

          {existingItemCount > 0 && (
            <div className="mt-4 rounded-2xl border border-rose-800/60 bg-rose-950/30 p-4 text-sm text-rose-200" role="alert">
              Safety stop active: this project already has {existingItemCount} BOQ item{existingItemCount === 1 ? "" : "s"}. This tool will not delete or mix with them.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200" role="status">
            {message}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-800 bg-slate-950 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <label className="block flex-1">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Find extracted item</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search description, type, unit or method"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllUsable}
                disabled={usableEntities.length === 0 || selectedEntities.length === usableEntities.length}
                className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select All Usable
              </button>
              <button
                type="button"
                onClick={bulkIgnoreAll}
                disabled={selectedEntities.length === 0}
                className="rounded-xl border border-amber-700 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Bulk Ignore All
              </button>
              <button
                type="button"
                onClick={() => void generateOneItemDraft()}
                disabled={isGenerating || selectedEntities.length !== 1 || existingItemCount > 0}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating
                  ? "Generating 1-item Draft…"
                  : selectedEntities.length === 1
                    ? `Ignore ${ignoredCount} Others + Generate Draft BOQ`
                    : "Select Exactly 1 Item"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            Only candidates with a positive quantity, a unit, a description, and an eligible extraction status are selectable. Unusable candidates remain untouched.
          </p>

          <div className="mt-6 space-y-3">
            {visibleEntities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                No usable extracted items match this search.
              </div>
            ) : (
              visibleEntities.map((entity) => {
                const selected = selectedIds.has(entity.id);
                return (
                  <article
                    key={entity.id}
                    className={`rounded-2xl border p-4 transition ${
                      selected
                        ? "border-cyan-500 bg-cyan-950/20"
                        : "border-slate-800 bg-slate-900/50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEntity(entity.id)}
                          className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-900"
                        />
                        <span className="min-w-0">
                          <span className="block break-words font-bold text-white">{entity.label}</span>
                          <span className="mt-1 block text-xs text-slate-400">
                            {formatLabel(entity.entityType)} · {entity.quantity} {entity.unit} · {entity.confidence}% · {formatLabel(entity.status)}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => selectOnly(entity.id)}
                        className="shrink-0 rounded-xl border border-cyan-700 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-950/30"
                      >
                        Use Only This Item
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-800 bg-slate-950 p-6 text-sm text-slate-300">
          <h2 className="font-black text-white">Acceptance gate</h2>
          <p className="mt-2 leading-6">
            Success means: exactly one selected extraction → exactly one BOQ item → editable draft BOQ. The tool stops instead of deleting or mixing with an existing non-empty BOQ.
          </p>
        </section>
      </div>
    </main>
  );
}
