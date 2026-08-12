"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the "we did not guess" recovery panel for a
 * single page none of the three deterministic table-recovery fallbacks
 * could safely resolve. Every action here is explicit and reviewable:
 * a manually-typed row is saved as SOURCE REVIEW evidence (NEEDS_REVIEW),
 * never auto-imported into the BOQ.
 */

type Props = {
  projectId: string;
  fileId: string;
  pageNumber: number;
};

type PanelState = "loading" | "closed" | "manual-form" | "saved" | "no-data-confirmed" | "structured-replacement";

type RecoveryStateResponse = {
  decision: "UNRESOLVED" | "MANUAL_DATA_ADDED" | "NO_BOQ_DATA_CONFIRMED" | "STRUCTURED_REPLACEMENT_PROVIDED";
  decidedAt: string | null;
};

function panelStateForDecision(decision: RecoveryStateResponse["decision"]): PanelState {
  switch (decision) {
    case "MANUAL_DATA_ADDED": return "saved";
    case "NO_BOQ_DATA_CONFIRMED": return "no-data-confirmed";
    case "STRUCTURED_REPLACEMENT_PROVIDED": return "structured-replacement";
    default: return "closed";
  }
}

export function PageRecoveryPanel({ projectId, fileId, pageNumber }: Props) {
  const t = useTranslations();
  const [state, setState] = useState<PanelState>("loading");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/pages/${pageNumber}`;

  // Restore the persisted decision on mount — a page already resolved in an
  // earlier session must not present as unresolved just because this
  // component instance is new.
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    apiClient.get<RecoveryStateResponse>(`${basePath}/recovery`)
      .then((resolution) => {
        if (!cancelled) setState(panelStateForDecision(resolution.decision));
      })
      .catch(() => {
        if (!cancelled) setState("closed");
      });
    return () => { cancelled = true; };
  }, [basePath]);

  const saveManualRow = useCallback(async () => {
    if (!itemCode.trim() || !description.trim()) {
      setError(t("source.recovery.requiredFieldsError"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`${basePath}/manual-row`, {
        itemCode: itemCode.trim(),
        description: description.trim(),
        quantity: quantity.trim() ? Number(quantity) : undefined,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setState("saved");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [basePath, description, itemCode, notes, quantity, unit, t]);

  const markNoData = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`${basePath}/mark-no-data`, {});
      setState("no-data-confirmed");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [basePath]);

  if (state === "loading") {
    return (
      <div role="status" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        {t("source.recovery.checking", { page: pageNumber })}
      </div>
    );
  }

  if (state === "structured-replacement") {
    return (
      <div role="status" className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">
        {t("source.recovery.structuredReplacement", { page: pageNumber })}
      </div>
    );
  }

  if (state === "saved") {
    return (
      <div role="status" className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">
        <p className="font-semibold text-white">{t("source.recovery.added")}</p>
        <a
          href={`/projects/${encodeURIComponent(projectId)}/extractions`}
          className="mt-3 inline-flex rounded-2xl border border-emerald-800 bg-emerald-900/40 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
        >
          {t("source.recovery.checkMyInformation")}
        </a>
      </div>
    );
  }

  if (state === "no-data-confirmed") {
    return (
      <div role="status" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        {t("source.recovery.noDataConfirmed", { page: pageNumber })}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-900/70 bg-amber-950/10 p-4">
      <p className="text-sm font-semibold text-amber-200">{t("source.recovery.needsHelpTitle", { page: pageNumber })}</p>
      <p className="mt-1 text-xs text-slate-400">{t("source.review.couldNotRebuild")}</p>

      {state === "closed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setState("manual-form")}
            className="rounded-2xl border border-blue-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            {t("source.recovery.typeInformation")}
          </button>
          <a
            href={`/projects/${encodeURIComponent(projectId)}/files`}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t("source.recovery.useExcelInstead")}
          </a>
          <button
            type="button"
            onClick={() => void markNoData()}
            disabled={isSaving}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {t("source.recovery.markNoData")}
          </button>
          <button
            type="button"
            onClick={() => setState("closed")}
            className="rounded-2xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            {t("source.recovery.continueOther")}
          </button>
        </div>
      )}

      {state === "manual-form" && (
        <div className="mt-3 space-y-2">
          <input
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            placeholder={t("source.recovery.itemCodePlaceholder")}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("source.recovery.descriptionPlaceholder")}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t("source.recovery.quantityPlaceholder")}
              type="number"
              dir="ltr"
              className="w-1/2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-start"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={t("source.recovery.unitPlaceholder")}
              className="w-1/2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("source.recovery.notesPlaceholder")}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveManualRow()}
              disabled={isSaving}
              className="rounded-2xl border border-blue-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? t("source.recovery.saving") : t("source.recovery.save")}
            </button>
            <button
              type="button"
              onClick={() => setState("closed")}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

export default PageRecoveryPanel;
