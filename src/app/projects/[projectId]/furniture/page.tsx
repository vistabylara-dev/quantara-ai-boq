"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import type { FurnitureEdgeBanding, FurniturePartCandidate } from "@/lib/furniture/candidate-mapper";
import {
  FURNITURE_ORDER_CATEGORIES,
  type FurnitureOrderCategory,
} from "@/lib/furniture/calculations";
import type { FurnitureOrderItemCandidate } from "@/lib/furniture/order-item-mapper";
import { FURNITURE_JOINERY_INDUSTRY_KEY } from "@/lib/furniture/types";

type ProjectView = { id: string; name: string; reference: string; industryId: string };
type BoqChoice = { id: string; title: string; revision: string; status: string; isLocked?: boolean };
type CandidateView = {
  id: string;
  projectId: string;
  projectFileId: string;
  status: string;
  candidate: FurniturePartCandidate;
  correction: unknown;
  confirmedAt: string | null;
};
type OrderItemView = {
  id: string;
  projectId: string;
  projectFileId: string;
  status: string;
  candidate: FurnitureOrderItemCandidate;
  correction: unknown;
  confirmedAt: string | null;
};
type EdgeChoice = "NONE" | "WIDTH" | "HEIGHT" | "ALL_FOUR" | "UNRESOLVED";
type CandidateDraft = {
  room: string;
  elevationReference: string;
  assembly: string;
  part: string;
  quantity: string;
  width: string;
  height: string;
  depth: string;
  thickness: string;
  materialName: string;
  finish: string;
  grainDirection: string;
  hardwareNotes: string;
  edgeChoice: EdgeChoice;
  notes: string;
  reason: string;
  acknowledgeReviewItems: boolean;
};
type OrderItemDraft = {
  description: string;
  quantity: string;
  unit: string;
  category: FurnitureOrderCategory;
  suppliedByOthers: boolean;
  notes: string;
  reason: string;
  acknowledgeReviewItems: boolean;
};

const fieldClass = "mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] outline-none focus:border-[#009FE3] disabled:opacity-60 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white";

function textNumber(value: number | null) { return value === null ? "" : String(value); }
function candidateEdgeChoice(candidate: FurniturePartCandidate): EdgeChoice {
  if (candidate.edgeBanding.mode === "NONE") return "NONE";
  if (candidate.edgeBanding.mode === "ALL_FOUR") return "ALL_FOUR";
  if (candidate.edgeBanding.mode === "UNRESOLVED") return "UNRESOLVED";
  return candidate.edgeBanding.selectedEdges[0]?.dimension ?? "UNRESOLVED";
}
function draftFrom(candidate: FurniturePartCandidate): CandidateDraft {
  return {
    room: candidate.room,
    elevationReference: candidate.elevationReference,
    assembly: candidate.assembly,
    part: candidate.part,
    quantity: textNumber(candidate.quantity),
    width: textNumber(candidate.dimensions.width.valueMm),
    height: textNumber(candidate.dimensions.height.valueMm),
    depth: textNumber(candidate.dimensions.depth.valueMm),
    thickness: textNumber(candidate.dimensions.thickness.valueMm),
    materialName: candidate.material.name,
    finish: candidate.material.finish ?? "",
    grainDirection: candidate.grainDirection ?? "",
    hardwareNotes: candidate.hardwareNotes.join("\n"),
    edgeChoice: candidateEdgeChoice(candidate),
    notes: candidate.notes ?? "",
    reason: "",
    acknowledgeReviewItems: false,
  };
}
function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Dimensions and quantities must be positive numbers.");
  return parsed;
}
function edgeBanding(choice: EdgeChoice): FurnitureEdgeBanding {
  if (choice === "NONE") return { raw: "None", mode: "NONE", selectedEdges: [], orientation: "EXPLICIT" };
  if (choice === "ALL_FOUR") return { raw: "All four edges", mode: "ALL_FOUR", selectedEdges: [{ dimension: "WIDTH", count: 2 }, { dimension: "HEIGHT", count: 2 }], orientation: "EXPLICIT" };
  if (choice === "WIDTH" || choice === "HEIGHT") return { raw: `Front edge (${choice.toLowerCase()})`, mode: "FRONT", selectedEdges: [{ dimension: choice, count: 1 }], orientation: "EXPLICIT" };
  return { raw: "Orientation to be verified", mode: "UNRESOLVED", selectedEdges: [], orientation: "UNRESOLVED" };
}
function orderDraftFrom(candidate: FurnitureOrderItemCandidate): OrderItemDraft {
  return {
    description: candidate.description,
    quantity: textNumber(candidate.quantity),
    unit: candidate.unit ?? "",
    category: candidate.category,
    suppliedByOthers: candidate.suppliedByOthers,
    notes: candidate.notes ?? "",
    reason: "",
    acknowledgeReviewItems: false,
  };
}

export default function FurnitureWorkspacePage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(props.params);
  const encodedProjectId = encodeURIComponent(projectId);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [boqs, setBoqs] = useState<BoqChoice[]>([]);
  const [selectedBoqId, setSelectedBoqId] = useState("");
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<string, OrderItemDraft>>({});
  const [wastage, setWastage] = useState("10");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, candidateData, orderItemData, boqData] = await Promise.all([
        apiClient.get<ProjectView>(`/api/projects/${encodedProjectId}`, signal),
        apiClient.get<CandidateView[]>(`/api/projects/${encodedProjectId}/furniture/candidates`, signal),
        apiClient.get<OrderItemView[]>(`/api/projects/${encodedProjectId}/furniture/order-items`, signal),
        apiClient.get<BoqChoice[]>(`/api/projects/${encodedProjectId}/boqs`, signal),
      ]);
      setProject(projectData);
      setCandidates(candidateData);
      setOrderItems(orderItemData);
      setBoqs(boqData);
      setSelectedBoqId((current) => {
        if (boqData.some((boq) => boq.id === current && !boq.isLocked && boq.status === "draft")) return current;
        return boqData.find((boq) => !boq.isLocked && boq.status === "draft")?.id ?? "";
      });
      setDrafts(Object.fromEntries(candidateData.map((entry) => [entry.id, draftFrom(entry.candidate)])));
      setOrderDrafts(Object.fromEntries(orderItemData.map((entry) => [entry.id, orderDraftFrom(entry.candidate)])));
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [encodedProjectId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const stats = useMemo(() => ({
    rooms: new Set(candidates.map((entry) => entry.candidate.room).filter(Boolean)).size,
    assemblies: new Set(candidates.map((entry) => entry.candidate.assemblyGroupKey)).size,
    parts: candidates.length,
    locked: candidates.filter((entry) => entry.status === "CONFIRMED").length,
    orderItems: orderItems.length,
    lockedOrderItems: orderItems.filter((entry) => entry.status === "CONFIRMED").length,
    blocking: candidates.reduce((sum, entry) => sum + entry.candidate.issues.filter((issue) => issue.severity === "BLOCKING").length, 0)
      + orderItems.reduce((sum, entry) => sum + entry.candidate.issues.filter((issue) => issue.severity === "BLOCKING").length, 0),
  }), [candidates, orderItems]);

  function updateDraft(id: string, patch: Partial<CandidateDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  function replaceCandidate(updated: CandidateView) {
    setCandidates((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    setDrafts((current) => ({ ...current, [updated.id]: draftFrom(updated.candidate) }));
  }
  function updateOrderDraft(id: string, patch: Partial<OrderItemDraft>) {
    setOrderDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  function replaceOrderItem(updated: OrderItemView) {
    setOrderItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    setOrderDrafts((current) => ({ ...current, [updated.id]: orderDraftFrom(updated.candidate) }));
  }
  async function save(entry: CandidateView) {
    const draft = drafts[entry.id];
    if (!draft || draft.reason.trim().length < 3) {
      setError("Enter a short professional-review reason before saving corrected values.");
      return;
    }
    setPending(entry.id); setError(null); setMessage(null);
    try {
      replaceCandidate(await apiClient.patch<CandidateView>(`/api/projects/${encodedProjectId}/furniture/candidates/${encodeURIComponent(entry.id)}`, {
        room: draft.room,
        elevationReference: draft.elevationReference,
        assembly: draft.assembly,
        part: draft.part,
        quantity: positiveNumber(draft.quantity),
        dimensions: { width: positiveNumber(draft.width), height: positiveNumber(draft.height), depth: positiveNumber(draft.depth), thickness: positiveNumber(draft.thickness) },
        materialName: draft.materialName,
        finish: draft.finish || null,
        grainDirection: draft.grainDirection || null,
        hardwareNotes: draft.hardwareNotes.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        edgeBanding: edgeBanding(draft.edgeChoice),
        notes: draft.notes || null,
        reason: draft.reason,
      }));
      setMessage("Correction saved with its original source evidence.");
    } catch (saveError) { setError(getApiErrorMessage(saveError)); }
    finally { setPending(null); }
  }
  async function approve(entry: CandidateView) {
    const draft = drafts[entry.id];
    if (!draft) return;
    const reviewIssues = entry.candidate.issues.filter((issue) => issue.severity === "REVIEW");
    if (reviewIssues.length > 0 && !draft.acknowledgeReviewItems) {
      setError("Acknowledge the remaining verification items before locking this value.");
      return;
    }
    setPending(entry.id); setError(null); setMessage(null);
    try {
      replaceCandidate(await apiClient.post<CandidateView>(`/api/projects/${encodedProjectId}/furniture/candidates/${encodeURIComponent(entry.id)}/approve`, {
        acknowledgedIssueCodes: reviewIssues.map((issue) => issue.code),
      }));
      setMessage("Verified values approved and locked.");
    } catch (approveError) { setError(getApiErrorMessage(approveError)); }
    finally { setPending(null); }
  }
  async function saveOrderItem(entry: OrderItemView) {
    const draft = orderDrafts[entry.id];
    if (!draft || draft.reason.trim().length < 3) {
      setError("Enter a short professional-review reason before saving the order item.");
      return;
    }
    const pendingKey = `order:${entry.id}`;
    setPending(pendingKey); setError(null); setMessage(null);
    try {
      replaceOrderItem(await apiClient.patch<OrderItemView>(`/api/projects/${encodedProjectId}/furniture/order-items/${encodeURIComponent(entry.id)}`, {
        description: draft.description,
        quantity: positiveNumber(draft.quantity),
        unit: draft.unit || null,
        category: draft.category,
        suppliedByOthers: draft.suppliedByOthers,
        notes: draft.notes || null,
        reason: draft.reason,
      }));
      setMessage("Hardware/order item correction saved with source evidence.");
    } catch (saveError) { setError(getApiErrorMessage(saveError)); }
    finally { setPending(null); }
  }
  async function approveOrderItem(entry: OrderItemView) {
    const draft = orderDrafts[entry.id];
    if (!draft) return;
    const reviewIssues = entry.candidate.issues.filter((issue) => issue.severity === "REVIEW");
    if (reviewIssues.length > 0 && !draft.acknowledgeReviewItems) {
      setError("Acknowledge the remaining hardware/order verification items before locking.");
      return;
    }
    const pendingKey = `order:${entry.id}`;
    setPending(pendingKey); setError(null); setMessage(null);
    try {
      replaceOrderItem(await apiClient.post<OrderItemView>(`/api/projects/${encodedProjectId}/furniture/order-items/${encodeURIComponent(entry.id)}/approve`, {
        acknowledgedIssueCodes: reviewIssues.map((issue) => issue.code),
      }));
      setMessage("Hardware/order item approved and locked.");
    } catch (approveError) { setError(getApiErrorMessage(approveError)); }
    finally { setPending(null); }
  }
  async function generateBoq() {
    const value = Number(wastage);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setError("Enter a wastage percentage from 0 to 100."); return; }
    if (!selectedBoqId) { setError("Create or select an unlocked draft BOQ before generating furniture outputs."); return; }
    if (candidates.length === 0 || stats.locked !== candidates.length || stats.lockedOrderItems !== orderItems.length) {
      setError("Review and lock every detected part and hardware/order item before generating outputs.");
      return;
    }
    setPending("generate"); setError(null); setMessage(null);
    try {
      const result = await apiClient.post<{ createdItems: number; updatedItems: number; removedManagedItems: number; preservedManualItems: number }>(`/api/projects/${encodedProjectId}/furniture/generate-boq`, { boqId: selectedBoqId, wastagePercentage: value });
      setMessage(`Five-section output regenerated (${result.createdItems} created, ${result.updatedItems} updated, ${result.removedManagedItems} stale managed rows removed). ${result.preservedManualItems} manual rows were preserved.`);
    } catch (generationError) { setError(getApiErrorMessage(generationError)); }
    finally { setPending(null); }
  }

  if (loading) return <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">Loading Furniture, Joinery &amp; Cabinetry workspace…</div>;
  if (error && !project) return <div role="alert" className="rounded-[32px] border border-rose-300 bg-rose-50 p-8 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">{error}</div>;
  if (!project || project.industryId !== FURNITURE_JOINERY_INDUSTRY_KEY) return <div className="rounded-[32px] border border-amber-800 bg-amber-950/30 p-8 text-amber-200">This workspace is available only for Furniture, Joinery &amp; Cabinetry projects.</div>;

  return <div className="space-y-6">
    <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0077B6] dark:text-[#21C7F3]">Furniture, Joinery &amp; Cabinetry</p>
      <h2 className="mt-2 text-3xl font-semibold text-[#0B1630] dark:text-white">Verified assemblies, parts and order quantities</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">Source values stay linked through Room → Elevation/Reference → Unit/Assembly → Part. Correct uncertain values, approve and lock them, then regenerate the reconciled material BOQ, hardware BOQ and cutting list.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/projects/${encodedProjectId}/drawings`} className="rounded-xl border border-[#009FE3] px-4 py-2 text-sm font-semibold text-[#0077B6] dark:text-[#21C7F3]">Upload PDF</Link>
        <Link href={`/projects/${encodedProjectId}/files`} className="rounded-xl border border-[#009FE3] px-4 py-2 text-sm font-semibold text-[#0077B6] dark:text-[#21C7F3]">Upload spreadsheet / process source</Link>
        <Link href={`/projects/${encodedProjectId}/documents`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Documents</Link>
        <Link href={`/projects/${encodedProjectId}/proposals`} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Client proposal</Link>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-5">{Object.entries(stats).map(([label, value]) => <div key={label} className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 dark:border-[#1E2A42] dark:bg-[#111D33]"><p className="text-2xl font-semibold text-[#0B1630] dark:text-white">{value}</p><p className="mt-1 text-xs capitalize text-[#7B879C] dark:text-[#7F8DA6]">{label}</p></div>)}</div>
    </section>

    {(error || message) && <div role={error ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"}`}>{error ?? message}</div>}

    {candidates.length === 0 ? <section className="rounded-[32px] border border-dashed border-[#D9E2EC] bg-white p-8 text-[#536078] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#B8C4D8]">No candidates yet. Upload a supported PDF or spreadsheet and run its existing extraction once.</section> : <section className="space-y-4">{candidates.map((entry) => {
      const draft = drafts[entry.id] ?? draftFrom(entry.candidate);
      const locked = entry.status === "CONFIRMED" || entry.status === "IMPORTED";
      const blocking = entry.candidate.issues.filter((issue) => issue.severity === "BLOCKING");
      const review = entry.candidate.issues.filter((issue) => issue.severity === "REVIEW");
      const fields = [["Room", "room"], ["Elevation / reference", "elevationReference"], ["Unit / assembly", "assembly"], ["Part", "part"], ["Quantity", "quantity"], ["Width (mm)", "width"], ["Height (mm)", "height"], ["Depth (mm)", "depth"], ["Thickness (mm)", "thickness"], ["Material", "materialName"], ["Finish / colour", "finish"], ["Grain direction", "grainDirection"]] as const;
      return <article key={entry.id} className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7B879C] dark:text-[#7F8DA6]">{entry.candidate.discipline.replace("_", " & ")}</p><h3 className="mt-1 text-lg font-semibold text-[#0B1630] dark:text-white">{entry.candidate.room} → {entry.candidate.elevationReference} → {entry.candidate.assembly} → {entry.candidate.part}</h3><p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{entry.candidate.evidence.sourceFileName} · {entry.candidate.evidence.sheetName ?? (entry.candidate.evidence.pageNumber ? `Page ${entry.candidate.evidence.pageNumber}` : "Source table")} · row {entry.candidate.evidence.rowNumber}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{locked ? "Approved & locked" : "Needs verification"}</span></div>
        <dl className="mt-4 grid gap-3 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 text-xs dark:border-[#1E2A42] dark:bg-[#111D33] sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="font-semibold text-[#536078] dark:text-[#B8C4D8]">Drawing reference</dt><dd className="mt-1 text-[#0B1630] dark:text-white">{entry.candidate.evidence.drawingReference ?? entry.candidate.elevationReference}</dd></div>
          <div><dt className="font-semibold text-[#536078] dark:text-[#B8C4D8]">Evidence location</dt><dd className="mt-1 text-[#0B1630] dark:text-white">{entry.candidate.evidence.sheetName ? `${entry.candidate.evidence.sheetName}, row ${entry.candidate.evidence.rowNumber}` : `Page ${entry.candidate.evidence.pageNumber ?? "not stated"}, row ${entry.candidate.evidence.rowNumber}`}</dd></div>
          <div><dt className="font-semibold text-[#536078] dark:text-[#B8C4D8]">Extraction method</dt><dd className="mt-1 text-[#0B1630] dark:text-white">{entry.candidate.evidence.method}</dd></div>
          <div><dt className="font-semibold text-[#536078] dark:text-[#B8C4D8]">Confidence</dt><dd className="mt-1 text-[#0B1630] dark:text-white">{entry.candidate.evidence.confidence === null ? "Not reported" : `${entry.candidate.evidence.confidence.toFixed(1)}%`}</dd></div>
        </dl>
        {entry.candidate.issues.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.candidate.issues.map((item, index) => <span key={`${item.code}-${index}`} className={`rounded-lg border px-2.5 py-1 text-xs ${item.severity === "BLOCKING" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>{item.message}</span>)}</div>}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{fields.map(([label, key]) => <label key={key} className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">{label}<input value={draft[key]} disabled={locked} onChange={(event) => updateDraft(entry.id, { [key]: event.target.value })} className={fieldClass} /></label>)}
          <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Edge banding<select value={draft.edgeChoice} disabled={locked} onChange={(event) => updateDraft(entry.id, { edgeChoice: event.target.value as EdgeChoice })} className={fieldClass}><option value="UNRESOLVED">Requires verification</option><option value="NONE">None</option><option value="WIDTH">One width edge</option><option value="HEIGHT">One height edge</option><option value="ALL_FOUR">All four edges</option></select></label>
          <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8] xl:col-span-2">Hardware / accessories (one per line)<textarea rows={2} value={draft.hardwareNotes} disabled={locked} onChange={(event) => updateDraft(entry.id, { hardwareNotes: event.target.value })} className={fieldClass} /></label>
          <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Notes<input value={draft.notes} disabled={locked} onChange={(event) => updateDraft(entry.id, { notes: event.target.value })} className={fieldClass} /></label>
        </div>
        <details className="mt-4 rounded-2xl border border-[#D9E2EC] p-4 text-xs dark:border-[#1E2A42]"><summary className="cursor-pointer font-semibold text-[#0077B6] dark:text-[#21C7F3]">Inspect source-cell evidence</summary><div className="mt-3 space-y-2 text-[#536078] dark:text-[#B8C4D8]"><p>{entry.candidate.evidence.sourceCellReferences.length > 0 ? entry.candidate.evidence.sourceCellReferences.join(" · ") : "No source-cell reference was reported."}</p>{Object.entries(entry.candidate.evidence.rawCells).map(([key, value]) => <p key={key}><span className="font-semibold">{key}:</span> {value}</p>)}</div></details>
        {!locked && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"><label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Correction reason<input value={draft.reason} onChange={(event) => updateDraft(entry.id, { reason: event.target.value })} placeholder="What source evidence was checked?" className={fieldClass} /></label><button type="button" disabled={pending === entry.id} onClick={() => void save(entry)} className="rounded-xl border border-[#009FE3] px-4 py-2.5 text-sm font-semibold text-[#0077B6] disabled:opacity-50">Save correction</button><button type="button" disabled={pending === entry.id || blocking.length > 0} onClick={() => void approve(entry)} className="rounded-xl bg-[#009FE3] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Approve &amp; lock</button>{review.length > 0 && <label className="flex items-center gap-2 text-xs text-amber-800 md:col-span-3"><input type="checkbox" checked={draft.acknowledgeReviewItems} onChange={(event) => updateDraft(entry.id, { acknowledgeReviewItems: event.target.checked })} />I reviewed and acknowledge the remaining orientation, finish, grain or other verification notes.</label>}</div>}
      </article>;
    })}</section>}

    {orderItems.length > 0 && <section className="space-y-4">
      <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]"><h3 className="text-xl font-semibold text-[#0B1630] dark:text-white">Hardware, accessories and specialist order items</h3><p className="mt-2 text-sm text-[#536078] dark:text-[#B8C4D8]">Review quantities, ordering units and explicit categories separately from board materials. Nothing pending is included in generated outputs.</p></div>
      {orderItems.map((entry) => {
        const draft = orderDrafts[entry.id] ?? orderDraftFrom(entry.candidate);
        const locked = entry.status === "CONFIRMED" || entry.status === "IMPORTED";
        const blocking = entry.candidate.issues.filter((issue) => issue.severity === "BLOCKING");
        const review = entry.candidate.issues.filter((issue) => issue.severity === "REVIEW");
        const pendingKey = `order:${entry.id}`;
        return <article key={entry.id} className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-semibold text-[#0B1630] dark:text-white">{entry.candidate.description}</h4><p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{entry.candidate.evidence.sourceFileName || "Uploaded source"} · {entry.candidate.evidence.sheetName ?? (entry.candidate.evidence.pageNumber === null ? "Source table" : `Page ${entry.candidate.evidence.pageNumber}`)} · row {entry.candidate.evidence.rowNumber}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{locked ? "Approved & locked" : "Needs verification"}</span></div>
          {entry.candidate.issues.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{entry.candidate.issues.map((item, index) => <span key={`${item.code}-${index}`} className={`rounded-lg border px-2.5 py-1 text-xs ${item.severity === "BLOCKING" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>{item.message}</span>)}</div>}
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8] xl:col-span-2">Description<input value={draft.description} disabled={locked} onChange={(event) => updateOrderDraft(entry.id, { description: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Quantity<input value={draft.quantity} disabled={locked} onChange={(event) => updateOrderDraft(entry.id, { quantity: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Ordering unit<input value={draft.unit} disabled={locked} onChange={(event) => updateOrderDraft(entry.id, { unit: event.target.value })} className={fieldClass} /></label>
            <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Order category<select value={draft.category} disabled={locked || draft.suppliedByOthers} onChange={(event) => updateOrderDraft(entry.id, { category: event.target.value as FurnitureOrderCategory })} className={fieldClass}>{FURNITURE_ORDER_CATEGORIES.map((category) => <option key={category} value={category}>{category.replace(/_/g, " ")}</option>)}</select></label>
            <label className="flex items-center gap-2 text-xs text-[#536078] dark:text-[#B8C4D8]"><input type="checkbox" checked={draft.suppliedByOthers} disabled={locked} onChange={(event) => updateOrderDraft(entry.id, { suppliedByOthers: event.target.checked, category: event.target.checked ? "SUPPLIED_BY_OTHERS" : draft.category === "SUPPLIED_BY_OTHERS" ? "HARDWARE" : draft.category })} />Supplied by others</label>
            <label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8] xl:col-span-2">Notes<input value={draft.notes} disabled={locked} onChange={(event) => updateOrderDraft(entry.id, { notes: event.target.value })} className={fieldClass} /></label>
          </div>
          <details className="mt-4 rounded-2xl border border-[#D9E2EC] p-4 text-xs dark:border-[#1E2A42]"><summary className="cursor-pointer font-semibold text-[#0077B6] dark:text-[#21C7F3]">Inspect order-item evidence</summary><div className="mt-3 space-y-2 text-[#536078] dark:text-[#B8C4D8]">{Object.entries(entry.candidate.evidence.rawCells).map(([key, value]) => <p key={key}><span className="font-semibold">{key}:</span> {value}</p>)}</div></details>
          {!locked && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"><label className="text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Correction reason<input value={draft.reason} onChange={(event) => updateOrderDraft(entry.id, { reason: event.target.value })} placeholder="What source evidence was checked?" className={fieldClass} /></label><button type="button" disabled={pending === pendingKey} onClick={() => void saveOrderItem(entry)} className="rounded-xl border border-[#009FE3] px-4 py-2.5 text-sm font-semibold text-[#0077B6] disabled:opacity-50">Save correction</button><button type="button" disabled={pending === pendingKey || blocking.length > 0} onClick={() => void approveOrderItem(entry)} className="rounded-xl bg-[#009FE3] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Approve &amp; lock</button>{review.length > 0 && <label className="flex items-center gap-2 text-xs text-amber-800 md:col-span-3"><input type="checkbox" checked={draft.acknowledgeReviewItems} onChange={(event) => updateOrderDraft(entry.id, { acknowledgeReviewItems: event.target.checked })} />I reviewed and acknowledge the remaining unit or category verification notes.</label>}</div>}
        </article>;
      })}
    </section>}

    <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
      <h3 className="text-xl font-semibold text-[#0B1630] dark:text-white">Generate reconciled furniture outputs</h3>
      <p className="mt-2 text-sm text-[#536078] dark:text-[#B8C4D8]">Board wastage is visible and editable for this generation; it is never a hidden global constant.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {boqs.length > 0 ? <label className="min-w-64 text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Unlocked draft BOQ<select value={selectedBoqId} onChange={(event) => setSelectedBoqId(event.target.value)} className={fieldClass}><option value="">Select a draft BOQ</option>{boqs.map((boq) => <option key={boq.id} value={boq.id} disabled={Boolean(boq.isLocked) || boq.status !== "draft"}>{boq.title} · {boq.revision}{boq.isLocked || boq.status !== "draft" ? " (locked/read-only)" : ""}</option>)}</select></label> : <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">Create a draft BOQ in BOQ Studio first.</p>}
        <label className="w-48 text-xs font-medium text-[#536078] dark:text-[#B8C4D8]">Board wastage (%)<input type="number" min="0" max="100" step="0.1" value={wastage} onChange={(event) => setWastage(event.target.value)} className={fieldClass} /></label>
        <button type="button" disabled={pending === "generate" || candidates.length === 0 || stats.locked !== candidates.length || stats.lockedOrderItems !== orderItems.length || !selectedBoqId} onClick={() => void generateBoq()} className="rounded-xl bg-[#009FE3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{pending === "generate" ? "Regenerating…" : "Generate material BOQ, hardware BOQ & cutting list"}</button>
        <Link href={`/projects/${encodedProjectId}/boq`} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Open BOQ Studio</Link>
      </div>
    </section>
  </div>;
}
