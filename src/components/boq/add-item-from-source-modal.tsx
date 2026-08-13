"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  QuantityCalculationType,
} from "@prisma/client";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { listSupportedCalculationTypes } from "@/lib/calculations/required-dimensions-registry";
import { QuantityCalculationPanel } from "@/components/boq/quantity-calculation-panel";
import { useTranslations } from "@/lib/i18n/locale-provider";
import {
  translateCalculationType,
  translateExtractedEntityStatus,
  translateExtractedEntityType,
  translateExtractionMethod,
  translateSearchSource,
  type ItemSearchSource,
} from "@/lib/i18n/engineering-labels";

type Section = { id: string; title: string };

type SearchResultItem = {
  source: ItemSearchSource;
  id: string;
  itemCode: string;
  name: string;
  description: string;
  unit: string;
  locked: boolean;
  packageNames?: string[];
};

type ExtractedEntityView = {
  id: string;
  projectId: string;
  projectFileId: string;
  entityType: ExtractedEntityType;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  extractionMethod: ExtractionMethod;
  sourceText: string | null;
  status: ExtractedEntityStatus;
};

export type AddItemTab = "reviewed" | "search" | "manual";

type Props = {
  projectId: string;
  boqId: string;
  sections: Section[];
  nextItemNumber: number;
  initialTab?: AddItemTab;
  onClose: () => void;
  onAdded: () => void;
};

function humanizeEntityType(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

const SOURCE_TYPE_BY_RESULT_SOURCE: Record<ItemSearchSource, string> = {
  COMPANY_LIBRARY: "COMPANY_LIBRARY",
  RECENT: "COMPANY_LIBRARY",
  FAVORITE: "COMPANY_LIBRARY",
  MASTER_PACKAGE: "MASTER_ITEM",
  // CANVA-MODEL-1 — a Premium search result search-ranks as LOCKED_PREVIEW
  // (item-search-service.ts) but is still a real MasterItem the server will
  // now accept adding to a draft BOQ (see boq-item-source-service.ts).
  LOCKED_PREVIEW: "MASTER_ITEM",
  PREVIOUS_PROJECT: "PREVIOUS_BOQ",
  SUPPLIER_CATALOGUE: "RATE_CATALOGUE",
};

export default function AddItemFromSourceModal({
  projectId,
  boqId,
  sections,
  nextItemNumber,
  initialTab = "search",
  onClose,
  onAdded,
}: Props) {
  const t = useTranslations();
  const [tab, setTab] = useState<AddItemTab>(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [selected, setSelected] = useState<SearchResultItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviewedEntities, setReviewedEntities] = useState<ExtractedEntityView[]>([]);
  const [isLoadingReviewed, setIsLoadingReviewed] = useState(false);
  const [hasLoadedReviewed, setHasLoadedReviewed] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<ExtractedEntityView | null>(null);
  const [extractionDraft, setExtractionDraft] = useState({
    itemCode: "",
    category: "",
    description: "",
    specification: "",
    unitCost: "0",
    marginPercentage: "0",
  });
  const [useExtractionCalculation, setUseExtractionCalculation] = useState(false);
  const [extractionCalculationType, setExtractionCalculationType] = useState<QuantityCalculationType | "">("");
  const [confirmedExtractionCalculation, setConfirmedExtractionCalculation] = useState<{
    id: string;
    resultValue: number;
    resultUnit: string;
  } | null>(null);

  const [manualDraft, setManualDraft] = useState({ itemCode: "", category: "", description: "", specification: "", unit: "", unitCost: "0", marginPercentage: "0" });
  const [useMeasurementCalculation, setUseMeasurementCalculation] = useState(false);
  const [calculationType, setCalculationType] = useState<QuantityCalculationType | "">("");
  const [confirmedCalculation, setConfirmedCalculation] = useState<{ resultValue: number; resultUnit: string } | null>(null);
  const supportedCalculationTypes = listSupportedCalculationTypes();

  const switchToManualFromLocked = useCallback((item: SearchResultItem) => {
    setManualDraft((current) => ({ ...current, description: item.name, unit: item.unit }));
    setTab("manual");
  }, []);

  const search = useCallback(async (signal?: AbortSignal) => {
    setIsSearching(true);
    try {
      const data = await apiClient.get<{ items: SearchResultItem[] }>(`/api/items/search?q=${encodeURIComponent(query)}`, signal);
      setResults(data.items);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(getApiErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void search(controller.signal), 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    if (tab !== "reviewed") return;

    const controller = new AbortController();
    setIsLoadingReviewed(true);
    setHasLoadedReviewed(false);
    setError(null);

    apiClient
      .get<ExtractedEntityView[]>(
        `/api/projects/${encodeURIComponent(projectId)}/extractions`,
        controller.signal,
      )
      .then((entities) => {
        setReviewedEntities(
          entities.filter(
            (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
          ),
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingReviewed(false);
          setHasLoadedReviewed(true);
        }
      });

    return () => controller.abort();
  }, [projectId, tab]);

  const selectReviewedEntity = useCallback((entity: ExtractedEntityView) => {
    setSelectedEntity(entity);
    setExtractionDraft({
      itemCode: `EXT-${String(nextItemNumber).padStart(3, "0")}`.slice(0, 50),
      category: humanizeEntityType(entity.entityType).slice(0, 100),
      description: entity.label.slice(0, 500),
      specification: (entity.sourceText ?? "").slice(0, 2000),
      unitCost: "0",
      marginPercentage: "0",
    });
    setUseExtractionCalculation(false);
    setExtractionCalculationType("");
    setConfirmedExtractionCalculation(null);
    setError(null);
  }, [nextItemNumber]);

  const importReviewedEntity = useCallback(async () => {
    if (!selectedEntity) return;

    if (useExtractionCalculation && !confirmedExtractionCalculation) {
      setError(t("boqEditor.confirmCalculationBeforeImport"));
      return;
    }

    const effectiveQuantity = useExtractionCalculation
      ? confirmedExtractionCalculation?.resultValue ?? null
      : selectedEntity.quantity;

    const effectiveUnit = (
      useExtractionCalculation
        ? confirmedExtractionCalculation?.resultUnit ?? ""
        : selectedEntity.unit ?? ""
    ).trim();

    if (
      effectiveQuantity === null
      || !Number.isFinite(effectiveQuantity)
      || effectiveQuantity <= 0
      || !effectiveUnit
    ) {
      setError(t("boqEditor.reviewedItemNoUsableQuantity"));
      return;
    }

    const itemCode = extractionDraft.itemCode.trim();
    const category = extractionDraft.category.trim();
    const description = extractionDraft.description.trim();
    const unitCost = Number(extractionDraft.unitCost);
    const marginPercentage = Number(extractionDraft.marginPercentage);

    if (!itemCode || !category || !description) {
      setError(t("boqEditor.itemFieldsRequired"));
      return;
    }

    if (
      !Number.isFinite(unitCost)
      || unitCost < 0
      || !Number.isFinite(marginPercentage)
      || marginPercentage < 0
    ) {
      setError(t("boqEditor.unitCostMarginInvalid"));
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await apiClient.post(
        `/api/projects/${encodeURIComponent(projectId)}/extractions/import-to-boq`,
        {
          boqId,
          entityId: selectedEntity.id,
          sectionId,
          itemNumber: nextItemNumber,
          itemCode,
          category,
          description,
          specification: extractionDraft.specification,
          unit: effectiveUnit,
          quantity: effectiveQuantity,
          unitCost,
          marginPercentage,
          ...(confirmedExtractionCalculation
            ? { quantityCalculationId: confirmedExtractionCalculation.id }
            : {}),
        },
      );

      onAdded();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [
    boqId,
    confirmedExtractionCalculation,
    extractionDraft,
    nextItemNumber,
    onAdded,
    projectId,
    sectionId,
    selectedEntity,
    t,
    useExtractionCalculation,
  ]);

  const addFromSearch = useCallback(async () => {
    // CANVA-MODEL-1 — a Premium (selected.locked) result is intentionally
    // still addable: the server enforces entitlement only at clean-export
    // time now, never at draft-add time. See boq-item-source-service.ts.
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/boqs/${boqId}/items/from-source`, {
        sourceType: SOURCE_TYPE_BY_RESULT_SOURCE[selected.source] ?? "MANUAL",
        sourceId: selected.id,
        sectionId,
        itemNumber: nextItemNumber,
        quantity,
      });
      onAdded();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [boqId, nextItemNumber, onAdded, quantity, sectionId, selected]);

  const addManual = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/boqs/${boqId}/items/from-source`, {
        sourceType: "MANUAL",
        sectionId,
        itemNumber: nextItemNumber,
        quantity,
        overrides: manualDraft,
      });
      onAdded();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [boqId, manualDraft, nextItemNumber, onAdded, quantity, sectionId]);

  const directReviewedQuantityReady = Boolean(
    selectedEntity
    && selectedEntity.quantity !== null
    && selectedEntity.quantity > 0
    && selectedEntity.unit?.trim(),
  );

  const reviewedQuantityReady = useExtractionCalculation
    ? Boolean(confirmedExtractionCalculation)
    : directReviewedQuantityReady;

  const reviewedImportReady = Boolean(
    selectedEntity
    && sectionId
    && extractionDraft.itemCode.trim()
    && extractionDraft.category.trim()
    && extractionDraft.description.trim()
    && reviewedQuantityReady
    && extractionDraft.unitCost.trim()
    && extractionDraft.marginPercentage.trim(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">{t("boqCreate.addItem")}</h3>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">{t("common.close")}</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab("reviewed")} className={`rounded-full px-4 py-2 text-sm ${tab === "reviewed" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>
            {t("boqCreate.reviewedExtraction")}
          </button>
          <button type="button" onClick={() => setTab("search")} className={`rounded-full px-4 py-2 text-sm ${tab === "search" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>
            {t("boqCreate.searchCatalogueMyLibrary")}
          </button>
          <button type="button" onClick={() => setTab("manual")} className={`rounded-full px-4 py-2 text-sm ${tab === "manual" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>
            {t("boqCreate.enterManually")}
          </button>
        </div>

        <label className="mt-4 block text-sm text-slate-300">
          <span className="text-slate-400">{t("boqEditor.sectionLabel")}</span>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500">
            {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </label>

        {tab === "reviewed" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-4">
              <p className="text-sm font-semibold text-blue-200">{t("boqEditor.reviewedInfoTitle")}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {t("boqEditor.reviewedInfoDescription")}
              </p>
            </div>

            {isLoadingReviewed && (
              <p className="text-sm text-slate-400">{t("boqEditor.loadingReviewedExtraction")}</p>
            )}

            {!isLoadingReviewed && hasLoadedReviewed && reviewedEntities.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 p-5">
                <p className="text-sm text-slate-300">{t("boqEditor.noReviewedItems")}</p>
                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/extractions`}
                  className="mt-3 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200"
                >
                  {t("boqEditor.openExtractionReview")}
                </Link>
              </div>
            )}

            {reviewedEntities.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {reviewedEntities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => selectReviewedEntity(entity)}
                    className={`w-full rounded-2xl border px-4 py-3 text-start text-sm ${
                      selectedEntity?.id === entity.id
                        ? "border-blue-500 bg-blue-950/40"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-white">{entity.label}</span>
                      <span className="text-[0.65rem] uppercase tracking-wide text-emerald-300">
                        {translateExtractedEntityStatus(entity.status, t)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {translateExtractedEntityType(entity.entityType, t)}
                      {" · "}
                      {entity.quantity !== null ? entity.quantity : t("boqEditor.quantityNotProvided")}
                      {entity.unit ? ` ${entity.unit}` : ""}
                      {" · "}
                      {t("boqEditor.confidencePercent", { value: entity.confidence })}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selectedEntity && (
              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("boqEditor.selectedReviewedItem")}</p>
                    <h4 className="mt-2 font-semibold text-white">{selectedEntity.label}</h4>
                    <p className="mt-1 text-xs text-slate-400">
                      {t("boqEditor.methodLabel", { method: translateExtractionMethod(selectedEntity.extractionMethod, t) })}
                    </p>
                  </div>
                  <Link
                    href={`/projects/${encodeURIComponent(projectId)}/extractions`}
                    className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                  >
                    {t("boqEditor.reviewSourceData")}
                  </Link>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("boqEditor.sourceEvidence")}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                    {selectedEntity.sourceText || t("boqEditor.noSourceTextRetained")}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    <span className="text-slate-400">{t("boqEditor.itemCodeLabel")}</span>
                    <input
                      value={extractionDraft.itemCode}
                      maxLength={50}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, itemCode: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="text-sm text-slate-300">
                    <span className="text-slate-400">{t("boqEditor.categoryLabel")}</span>
                    <input
                      value={extractionDraft.category}
                      maxLength={100}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, category: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="text-sm text-slate-300 sm:col-span-2">
                    <span className="text-slate-400">{t("boqEditor.boqDescriptionLabel")}</span>
                    <input
                      value={extractionDraft.description}
                      maxLength={500}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, description: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="text-sm text-slate-300 sm:col-span-2">
                    <span className="text-slate-400">{t("boqEditor.boqSpecificationLabel")}</span>
                    <textarea
                      value={extractionDraft.specification}
                      maxLength={2000}
                      rows={4}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, specification: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      {t("boqEditor.specificationPrefilled")}
                    </span>
                  </label>

                  <label className="text-sm text-slate-300">
                    <span className="text-slate-400">{t("boqEditor.unitCostLabel")}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={extractionDraft.unitCost}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, unitCost: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="text-sm text-slate-300">
                    <span className="text-slate-400">{t("boqEditor.marginPercentLabel")}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={extractionDraft.marginPercentage}
                      onChange={(e) => setExtractionDraft((current) => ({ ...current, marginPercentage: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("boqEditor.reviewedQuantityLabel")}</p>
                  {directReviewedQuantityReady ? (
                    <p className="mt-2 text-sm font-semibold text-white">
                      {selectedEntity.quantity} {selectedEntity.unit}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-amber-300">
                      {t("boqEditor.reviewedQuantityUnavailable")}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={useExtractionCalculation}
                    onChange={(e) => {
                      setUseExtractionCalculation(e.target.checked);
                      setExtractionCalculationType("");
                      setConfirmedExtractionCalculation(null);
                      setError(null);
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900"
                  />
                  <span>
                    {t("boqEditor.useCalculationInsteadLabel")}
                    <span className="mt-1 block text-xs text-slate-500">
                      {t("boqEditor.useCalculationInsteadHelp")}
                    </span>
                  </span>
                </label>

                {useExtractionCalculation && (
                  <div className="space-y-3">
                    <label className="block text-sm text-slate-300">
                      <span className="text-slate-400">{t("boqEditor.calculationTypeLabel")}</span>
                      <select
                        value={extractionCalculationType}
                        onChange={(e) => {
                          setExtractionCalculationType(e.target.value as QuantityCalculationType);
                          setConfirmedExtractionCalculation(null);
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500"
                      >
                        <option value="">{t("boqEditor.selectSupportedCalculation")}</option>
                        {supportedCalculationTypes.map((type) => (
                          <option key={type} value={type}>
                            {translateCalculationType(type, t)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {extractionCalculationType && !confirmedExtractionCalculation && (
                      <QuantityCalculationPanel
                        projectId={projectId}
                        calculationType={extractionCalculationType}
                        extractedEntityId={selectedEntity.id}
                        onConfirmed={(calculation) => {
                          setConfirmedExtractionCalculation({
                            id: calculation.id,
                            resultValue: calculation.resultValue,
                            resultUnit: calculation.resultUnit,
                          });
                        }}
                      />
                    )}

                    {confirmedExtractionCalculation && (
                      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-300">
                        {t("boqEditor.confirmedCalculationValue", {
                          value: confirmedExtractionCalculation.resultValue,
                          unit: confirmedExtractionCalculation.resultUnit,
                        })}
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-rose-300">{error}</p>}

                <button
                  type="button"
                  onClick={() => void importReviewedEntity()}
                  disabled={isSaving || !reviewedImportReady}
                  className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? t("boqEditor.importing") : t("boqEditor.addReviewedItemToBoq")}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "search" && (
          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("boqCreate.fullSearchPlaceholder")}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {isSearching && <p className="text-xs text-slate-500">{t("boqCreate.searching")}</p>}
              {results.map((item) =>
                item.locked ? (
                  // CANVA-MODEL-1 — a Premium result stays fully selectable and
                  // addable to the working draft (the server no longer blocks
                  // this at add-time; see boq-item-source-service.ts). Only the
                  // CLEAN FINAL EXPORT is gated later, via the commercial
                  // requirements panel — the professional never hits a paywall
                  // just for wanting to use a premium spec while building.
                  <div
                    key={`${item.source}-${item.id}`}
                    className={`w-full rounded-2xl border px-4 py-3 text-start text-sm ${selected?.id === item.id ? "border-amber-500 bg-amber-950/40" : "border-amber-900/60 bg-amber-950/20 hover:border-amber-700"}`}
                  >
                    {/* A single interactive control for selection — Link/button below are SIBLINGS,
                        not nested inside it, so no control is ever nested inside another (invalid
                        markup that breaks keyboard focus and click handling). */}
                    <button type="button" onClick={() => setSelected(item)} className="w-full text-start">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-amber-100">
                          <span aria-hidden="true">👑</span>
                          {item.name}
                        </span>
                        <span className="rounded-full border border-amber-700 bg-amber-900/40 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-300">{t("boq.premium")}</span>
                      </div>
                      <p className="mt-1 text-xs text-amber-400">{item.packageNames?.[0] ?? t("boqCreate.industryLibrary")}</p>
                      <p className="text-xs text-slate-500"><span dir="ltr" className="inline-block">{item.itemCode}</span> · {item.unit}</p>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href="/marketplace" className="rounded-xl border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70">
                        {t("boqCreate.viewLibrary")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => switchToManualFromLocked(item)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        {t("boqCreate.enterManually")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    key={`${item.source}-${item.id}`}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full rounded-2xl border px-4 py-3 text-start text-sm ${selected?.id === item.id ? "border-blue-500 bg-blue-950/40" : "border-slate-800 bg-slate-900 hover:border-slate-700"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{item.name}</span>
                      <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">{translateSearchSource(item.source, t)}</span>
                    </div>
                    <p className="text-xs text-slate-500"><span dir="ltr" className="inline-block">{item.itemCode}</span> · {item.unit}</p>
                  </button>
                ),
              )}
              {!isSearching && results.length === 0 && <p className="text-xs text-slate-500">{t("boqCreate.noResults")}</p>}
            </div>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">{t("boqCreate.quantityLabel")}</span>
              <input dir="ltr" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-2 w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 text-start" />
            </label>

            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
            {selected?.locked && (
              <p className="mt-3 text-xs text-amber-300">
                👑 {t("boqCreate.premiumUsableExplanation")}
              </p>
            )}
            <button
              type="button"
              onClick={() => void addFromSearch()}
              disabled={isSaving || !selected || !sectionId}
              className="mt-4 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? t("boqCreate.adding") : selected?.locked ? t("boqCreate.useThisItem") : t("boqCreate.addToBoq")}
            </button>
          </div>
        )}

        {tab === "manual" && (
          <div className="mt-4 space-y-3">
            <input value={manualDraft.itemCode} onChange={(e) => setManualDraft({ ...manualDraft, itemCode: e.target.value })} placeholder={t("boqEditor.manualItemCodePlaceholder")} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.category} onChange={(e) => setManualDraft({ ...manualDraft, category: e.target.value })} placeholder={t("boqEditor.manualCategoryPlaceholder")} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.description} onChange={(e) => setManualDraft({ ...manualDraft, description: e.target.value })} placeholder={t("boqEditor.manualDescriptionPlaceholder")} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.specification} onChange={(e) => setManualDraft({ ...manualDraft, specification: e.target.value })} placeholder={t("boqEditor.manualSpecificationPlaceholder")} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={useMeasurementCalculation}
                onChange={(e) => {
                  setUseMeasurementCalculation(e.target.checked);
                  setConfirmedCalculation(null);
                  if (!e.target.checked) setCalculationType("");
                }}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              {t("boqEditor.addMeasurementCalculation")}
            </label>

            <p className="text-xs text-slate-500">
              {t("boqEditor.voiceInsideMeasurementPanel")}
            </p>

            {useMeasurementCalculation && (
              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <label className="block text-sm text-slate-300">
                  <span className="text-slate-400">{t("boqEditor.calculationTypeLabel")}</span>
                  <select
                    value={calculationType}
                    onChange={(e) => {
                      setCalculationType(e.target.value as QuantityCalculationType);
                      setConfirmedCalculation(null);
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                  >
                    <option value="">{t("boqEditor.selectCalculationType")}</option>
                    {supportedCalculationTypes.map((type) => (
                      <option key={type} value={type}>
                        {translateCalculationType(type, t)}
                      </option>
                    ))}
                  </select>
                </label>

                {calculationType && !confirmedCalculation && (
                  <QuantityCalculationPanel
                    projectId={projectId}
                    calculationType={calculationType}
                    onConfirmed={(calculation) => {
                      setConfirmedCalculation({ resultValue: calculation.resultValue, resultUnit: calculation.resultUnit });
                      setQuantity(String(calculation.resultValue));
                      setManualDraft((current) => ({ ...current, unit: calculation.resultUnit }));
                    }}
                  />
                )}

                {confirmedCalculation && (
                  <p className="text-sm text-emerald-300">
                    {t("boqEditor.usingCalculatedQuantity", { value: confirmedCalculation.resultValue, unit: confirmedCalculation.resultUnit })}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <input value={manualDraft.unit} onChange={(e) => setManualDraft({ ...manualDraft, unit: e.target.value })} placeholder={t("boqEditor.manualUnitPlaceholder")} readOnly={Boolean(confirmedCalculation)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 read-only:opacity-70" />
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("boqEditor.manualQuantityPlaceholder")} readOnly={Boolean(confirmedCalculation)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 read-only:opacity-70" />
              <input value={manualDraft.unitCost} onChange={(e) => setManualDraft({ ...manualDraft, unitCost: e.target.value })} placeholder={t("boqEditor.manualUnitCostPlaceholder")} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            </div>
            {error && <p className="text-xs text-rose-300">{error}</p>}
            <button
              type="button"
              onClick={() => void addManual()}
              disabled={isSaving || !manualDraft.itemCode || !manualDraft.description || !manualDraft.unit || !sectionId}
              className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? t("boqCreate.adding") : t("boqCreate.addToBoq")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
