"use client";

/**
 * ADMIN-CONTROL-1 section 8 — compact, platform-owner-only panel.
 * Everything here reads/writes through the real centralized services
 * (platform-simulation-service.ts, effective-entitlement-service.ts, and the
 * real document generator route) — no separate/fake behavior lives here.
 */

import { useCallback, useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type SimulationMode = "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "FREE" | "PRO" | "SINGLE_BOQ_UNLOCKED";

type SimulationStatus = {
  realRole: string;
  companyId: string;
  simulation: { mode: SimulationMode; targetBoqId: string | null; startedAt: string } | null;
  effective: {
    source: "real" | "owner-override" | "simulation";
    planName: string;
    status: string;
    isTrial: boolean;
    isExpiredOrNone: boolean;
    maxProjects: number | null;
    trialStartedAt: string | null;
    trialExpiresAt: string | null;
    simulationMode: SimulationMode | null;
    simulationTargetBoqId: string | null;
    watermarkExpected: boolean;
    cleanExportSummary: string;
  };
};

type CataloguePage = { total: number };

const modes: { mode: SimulationMode; label: string }[] = [
  { mode: "TRIAL_ACTIVE", label: "Simulate Trial" },
  { mode: "TRIAL_EXPIRED", label: "Simulate Expired Trial" },
  { mode: "FREE", label: "View as Unpaid Customer" },
  { mode: "PRO", label: "Simulate Pro" },
  { mode: "SINGLE_BOQ_UNLOCKED", label: "Simulate Single-BOQ Unlock" },
];

const box = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";
const input = "w-full rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-sm text-[#0B1630] dark:text-[#F7FAFC]";
const btn = "rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] px-3 py-2 text-xs font-semibold text-[#0B1630] dark:text-[#F7FAFC] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] disabled:opacity-50";
const btnPrimary = "rounded-xl border border-[#0EA5E9] dark:border-[#22D3EE] bg-[#0EA5E9] dark:bg-[#22D3EE] px-3 py-2 text-xs font-semibold text-white dark:text-[#050B18] hover:opacity-90 disabled:opacity-50";

export default function AdminTestPanel() {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [catalogueTotal, setCatalogueTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [targetBoqId, setTargetBoqId] = useState("");

  const [projectId, setProjectId] = useState("");
  const [boqId, setBoqId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [documentType, setDocumentType] = useState<"PDF" | "DOCX" | "XLSX" | "CSV" | "HTML">("PDF");
  const [audience, setAudience] = useState<"INTERNAL" | "CLIENT">("CLIENT");
  const [genResult, setGenResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const [statusData, catalogueData] = await Promise.all([
        apiClient.get<SimulationStatus>("/api/admin/simulation", signal),
        apiClient.get<CataloguePage>("/api/admin/master-catalogue/items?pageSize=1", signal),
      ]);
      setStatus(statusData);
      setCatalogueTotal(catalogueData.total);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const runSimulate = useCallback(async (mode: SimulationMode) => {
    if (mode === "SINGLE_BOQ_UNLOCKED" && !targetBoqId.trim()) {
      setActionError("Enter a BOQ ID from your own company to unlock for this simulation mode.");
      return;
    }
    setBusy(mode);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.post("/api/admin/simulation", {
        mode,
        targetBoqId: mode === "SINGLE_BOQ_UNLOCKED" ? targetBoqId.trim() : undefined,
      });

      if (mode === "FREE") {
        window.location.assign("/dashboard");
        return;
      }

      setActionMessage(`Simulation set to ${mode}.`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [targetBoqId, load]);

  const runExit = useCallback(async () => {
    setBusy("EXIT");
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.delete("/api/admin/simulation");
      setActionMessage("Simulation exited — actual owner access restored.");
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load]);

  const runGenerate = useCallback(async () => {
    if (!projectId.trim() || !boqId.trim() || !templateId.trim()) {
      setGenError("Project ID, BOQ ID, and Template ID are all required.");
      return;
    }
    setBusy("GENERATE");
    setGenError(null);
    setGenResult(null);
    try {
      const data = await apiClient.post<{
        fileName: string;
        generationMetadataJson: { isDraft: boolean; trialWatermarked: boolean } | null;
      }>(`/api/projects/${projectId.trim()}/documents/generate`, {
        boqId: boqId.trim(),
        templateId: templateId.trim(),
        documentType,
        audience,
        acknowledgedWarnings: true,
      });
      const meta = data.generationMetadataJson;
      setGenResult(
        `Generated ${data.fileName} — ${meta?.isDraft ? "DRAFT" : "FINAL"} export, watermark ${meta?.trialWatermarked ? "APPLIED" : "not applied"}.`,
      );
      await load();
    } catch (error) {
      setGenError(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [projectId, boqId, templateId, documentType, audience, load]);

  if (loadError) {
    return (
      <div id="test-panel" className={box}>
        <p className="text-sm text-[#D84A4A] dark:text-rose-300">Admin test panel could not load: {loadError}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div id="test-panel" className={box}>
        <div className="h-32 animate-pulse rounded-2xl bg-[#EEF3F8] dark:bg-[#111D33]" aria-hidden="true" />
      </div>
    );
  }

  const { effective, simulation } = status;

  return (
    <div id="test-panel" className={box}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#D6A84B]/40 bg-[#D6A84B]/10">
          <FlaskConical className="h-5 w-5 text-[#B4841F] dark:text-[#E0B25C]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">Admin test panel</h2>
          <p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">Owner-only. Never exposed to normal users.</p>
        </div>
      </div>

      {simulation && (
        <div className="mt-4 rounded-2xl border-2 border-[#D6A84B] bg-[#D6A84B]/10 px-4 py-3 text-sm font-semibold text-[#8A6316] dark:text-[#E0B25C]">
          CUSTOMER SIMULATION ACTIVE — Mode: {simulation.mode}
          {simulation.targetBoqId ? ` (BOQ ${simulation.targetBoqId.slice(0, 8)}...)` : ""}
        </div>
      )}

      {(actionMessage || actionError) && (
        <div className={`mt-4 rounded-2xl border p-3 text-sm ${actionError ? "border-[#D84A4A]/40 bg-[#D84A4A]/10 text-[#D84A4A]" : "border-[#159A6A]/40 bg-[#159A6A]/10 text-[#159A6A]"}`}>
          {actionError ?? actionMessage}
        </div>
      )}

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <StatusField term="Current real role" detail={status.realRole} />
        <StatusField term="Current company context" detail={status.companyId.slice(0, 8) + "..."} />
        <StatusField term="Current simulation mode" detail={effective.simulationMode ?? "None (owner override)"} />
        <StatusField term="Catalogue status" detail={catalogueTotal === null ? "Unavailable" : `${catalogueTotal} master items`} />
        <StatusField term="Trial start / end" detail={dateRange(effective.trialStartedAt, effective.trialExpiresAt)} />
        <StatusField term="Export entitlement" detail={effective.cleanExportSummary} />
        <StatusField term="Selected BOQ unlock" detail={effective.simulationTargetBoqId ? effective.simulationTargetBoqId.slice(0, 8) + "..." : "None"} />
        <StatusField term="Watermark expected" detail={effective.watermarkExpected ? "Yes" : "No"} />
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        {modes.map(({ mode, label }) => (
          <button key={mode} type="button" className={btn} disabled={busy !== null} onClick={() => void runSimulate(mode)}>
            {busy === mode ? "Applying..." : label}
          </button>
        ))}
        <button type="button" className={btn} disabled={busy !== null || !simulation} onClick={() => void runExit()}>
          {busy === "EXIT" ? "Exiting..." : "Exit Simulation"}
        </button>
      </div>
      <div className="mt-3 max-w-sm">
        <label className="text-xs text-[#7B879C] dark:text-[#7F8DA6]" htmlFor="target-boq">
          Target BOQ ID (required only for Single-BOQ Unlock, must belong to your own company)
        </label>
        <input
          id="target-boq"
          className={`${input} mt-1`}
          placeholder="00000000-0000-0000-0000-000000000000"
          value={targetBoqId}
          onChange={(event) => setTargetBoqId(event.target.value)}
        />
      </div>

      <div className="mt-8 border-t border-[#D9E2EC] dark:border-[#1E2A42] pt-6">
        <h3 className="text-sm font-semibold text-[#0B1630] dark:text-white">Generate test document</h3>
        <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
          Runs the real document generator for a BOQ in your own company. Use an unlocked BOQ for a watermarked preview test, or a locked BOQ to attempt a clean export under the current simulation.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className={input} placeholder="Project ID" value={projectId} onChange={(event) => setProjectId(event.target.value)} />
          <input className={input} placeholder="BOQ ID" value={boqId} onChange={(event) => setBoqId(event.target.value)} />
          <input className={input} placeholder="Template ID" value={templateId} onChange={(event) => setTemplateId(event.target.value)} />
          <select className={input} value={documentType} onChange={(event) => setDocumentType(event.target.value as typeof documentType)}>
            <option value="PDF">PDF</option>
            <option value="DOCX">DOCX</option>
            <option value="XLSX">XLSX</option>
            <option value="CSV">CSV</option>
            <option value="HTML">HTML</option>
          </select>
          <select className={input} value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}>
            <option value="CLIENT">CLIENT</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
          <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void runGenerate()}>
            {busy === "GENERATE" ? "Generating..." : "Generate test document"}
          </button>
        </div>
        {genResult && <p className="mt-3 text-sm text-[#159A6A] dark:text-emerald-300">{genResult}</p>}
        {genError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{genError}</p>}
      </div>
    </div>
  );
}

function StatusField({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-3">
      <dt className="text-xs uppercase tracking-[0.14em] text-[#7B879C] dark:text-[#7F8DA6]">{term}</dt>
      <dd className="mt-1 font-semibold text-[#0B1630] dark:text-white">{detail}</dd>
    </div>
  );
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Not applicable";
  const fmt = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
  return `${start ? fmt(start) : "?"} - ${end ? fmt(end) : "?"}`;
}
