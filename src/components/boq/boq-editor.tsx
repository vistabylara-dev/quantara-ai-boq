"use client";

import { useMemo, useState } from "react";
import type { BOQ, BOQItem, BOQSection } from "@/types/boq";
import {
  calculateEditableBOQItem,
  calculateRowTotal,
  calculateTotals,
  normalizeMarginMode,
  withCalculatedBOQTotals,
} from "@/lib/calculations/boq-totals";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDate } from "@/lib/formatting/dates";
import CatalogueRateDrawer from "@/components/boq/catalogue-rate-drawer";
import type { CatalogueItem } from "@/types/catalogue";

type BoqEditorProps = {
  boq: BOQ;
  currency: string;
  taxRate: number;
  industryId?: string;
  actionPending?: boolean;
  onChange: (boq: BOQ) => void;
  onSave: (boq: BOQ) => Promise<void> | void;
  onCreateRevision: (boq: BOQ) => Promise<void> | void;
  onLock: (boq: BOQ) => Promise<void> | void;
  onApplyCatalogueRate?: (itemId: string, catalogueItemId: string, confirmReplaceOverrides?: boolean) => Promise<void>;
  onAddItem?: () => void;
};

function isPersistedItemId(itemId: string): boolean {
  return !itemId.includes("-item-");
}

const emptyItem = (section: BOQSection, nextNumber: number): BOQItem => ({
  id: `${section.id}-item-${Date.now()}`,
  itemNumber: nextNumber,
  itemCode: "",
  category: "",
  description: "",
  specification: "",
  quantity: 0,
  unit: section.id === "furniture" ? "pcs" : "m2",
  unitCost: 0,
  freightCost: 0,
  installationCost: 0,
  additionalCost: 0,
  landedCost: 0,
  marginMode: "markup",
  marginPercentage: 10,
  sellingRate: 0,
  totalAmount: 0,
  wastagePercentage: 0,
  taxApplicable: true,
  sourceReference: "",
  roomOrZone: "",
  drawingReference: "",
  confidenceScore: 90,
  status: "draft",
  notes: "",
  options: [],
});

export default function BoqEditor({
  boq,
  currency,
  taxRate,
  industryId,
  actionPending = false,
  onChange,
  onSave,
  onCreateRevision,
  onLock,
  onApplyCatalogueRate,
  onAddItem,
}: BoqEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [rateDrawerItemId, setRateDrawerItemId] = useState<string | null>(null);
  const [isApplyingRate, setIsApplyingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const activeBoq = boq;
  const effectiveTaxRate = activeBoq.taxRate ?? taxRate;

  const totals = useMemo(
    () => calculateTotals(
      activeBoq.sections.flatMap((section) => section.items),
      activeBoq.totals.discountPercentage,
      effectiveTaxRate,
    ),
    [activeBoq, effectiveTaxRate]
  );

  const isReadOnly = Boolean(activeBoq.isLocked) || activeBoq.status === "locked" || activeBoq.status === "approved";

  const updateItem = (sectionId: string, itemId: string, key: keyof BOQItem, value: string | number | boolean) => {
    if (isReadOnly) return;
    onChange({
      ...activeBoq,
      sections: activeBoq.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          items: section.items.map((item) => {
            if (item.id !== itemId) return item;
            let updated = { ...item, [key]: value } as BOQItem;
            if (key === "quantity" || key === "sellingRate") {
              updated.totalAmount = calculateRowTotal(updated.quantity, updated.sellingRate);
            }
            if (
              key === "unitCost" ||
              key === "freightCost" ||
              key === "installationCost" ||
              key === "additionalCost" ||
              key === "marginMode" ||
              key === "marginPercentage"
            ) {
              if (
                key === "unitCost" &&
                updated.freightCost === undefined &&
                updated.installationCost === undefined &&
                updated.additionalCost === undefined
              ) {
                updated.landedCost = Number(updated.unitCost.toFixed(2));
              }
              updated = calculateEditableBOQItem(updated);
            }
            return updated;
          }),
        };
      }),
    });
  };

  const addItem = (sectionId: string) => {
    if (isReadOnly) return;
    const section = activeBoq.sections.find((entry) => entry.id === sectionId);
    if (!section) return;
    const nextNumber = section.items.length + 1;
    const newItem = emptyItem(section, nextNumber);
    onChange({
      ...activeBoq,
      sections: activeBoq.sections.map((entry) =>
        entry.id === sectionId ? { ...entry, items: [...entry.items, newItem] } : entry,
      ),
    });
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    if (isReadOnly) return;
    onChange({
      ...activeBoq,
      sections: activeBoq.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.filter((item) => item.id !== itemId),
            }
      ),
    });
  };

  const toggleSection = (sectionId: string) => {
    onChange({
      ...activeBoq,
      sections: activeBoq.sections.map((section) =>
        section.id === sectionId ? { ...section, collapsed: !section.collapsed } : section
      ),
    });
  };

  const currentPayload = () => withCalculatedBOQTotals(activeBoq, effectiveTaxRate);

  const save = async () => {
    if (isReadOnly || isSaving || actionPending) return;
    setIsSaving(true);
    try {
      await onSave(currentPayload());
    } finally {
      setIsSaving(false);
    }
  };

  const applyCatalogueRate = async (catalogueItem: CatalogueItem) => {
    if (!rateDrawerItemId || !onApplyCatalogueRate) return;
    setIsApplyingRate(true);
    setRateError(null);
    try {
      await onApplyCatalogueRate(rateDrawerItemId, catalogueItem.id);
      setRateDrawerItemId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply this rate.";
      if (message.includes("manually overridden")) {
        if (window.confirm(`${message}\n\nReplace the manual overrides with this catalogue rate?`)) {
          try {
            await onApplyCatalogueRate(rateDrawerItemId, catalogueItem.id, true);
            setRateDrawerItemId(null);
          } catch (retryError) {
            setRateError(retryError instanceof Error ? retryError.message : "Could not apply this rate.");
          }
        }
      } else {
        setRateError(message);
      }
    } finally {
      setIsApplyingRate(false);
    }
  };

  const isLegacyEmpty = isReadOnly && activeBoq.sections.every(s => s.items.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
            {isLegacyEmpty ? "Empty legacy revision" : "BOQ editor"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{activeBoq.title}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {isLegacyEmpty 
              ? "This legacy revision contains no items. Create a new editable revision to continue."
              : isReadOnly
                ? activeBoq.status === "approved"
                  ? "This revision is approved and read-only."
                  : "This revision is locked and read-only."
                : "Edit BOQ items, recalculate totals, and manage revision status."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isLegacyEmpty ? (
            <>
              <button
                type="button"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                View Audit History
              </button>
              <button
                type="button"
                onClick={() => void onCreateRevision(currentPayload())}
                disabled={actionPending}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create Editable Revision
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={isReadOnly || isSaving || actionPending}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => void onCreateRevision(currentPayload())}
                disabled={isSaving || actionPending}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create revision
              </button>
              <button
                type="button"
                title={activeBoq.sections.every(s => s.items.length === 0) ? "Add at least one valid item before locking this revision." : ""}
                onClick={() => void onLock(currentPayload())}
                disabled={isReadOnly || isSaving || actionPending || activeBoq.sections.every(s => s.items.length === 0)}
                className="rounded-2xl border border-slate-700 bg-[#1F2937] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Lock revision
              </button>
            </>
          )}
        </div>
      </div>

      {activeBoq.sections.every(s => s.items.length === 0) ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-12 text-center">
          <p className="text-xl font-semibold text-white">No items have been added to this BOQ yet.</p>
          <p className="mt-2 text-slate-400">Start building your Bill of Quantities to calculate totals.</p>
          
          {!isReadOnly && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const firstSection = activeBoq.sections[0];
                  if (firstSection && onAddItem) {
                    onAddItem();
                  }
                }}
                disabled={actionPending}
                className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add First Item
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstSection = activeBoq.sections[0];
                  if (firstSection && onAddItem) {
                    onAddItem();
                  }
                }}
                disabled={actionPending}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enter Item Manually
              </button>
              <button
                type="button"
                disabled={true}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-200 opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                Import Measurements
              </button>
            </div>
          )}
        </div>
      ) : activeBoq.sections.map((section) => (
        <section key={section.id} className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-6 py-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{section.code}</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{section.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
              >
                {section.collapsed ? "Expand" : "Collapse"}
              </button>
              <button
                type="button"
                onClick={() => onAddItem && onAddItem()}
                disabled={isReadOnly || actionPending}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add item
              </button>
            </div>
          </div>

          {section.collapsed ? (
            <div className="p-6 text-slate-400">Section is collapsed.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">#</th>
                    <th className="whitespace-nowrap px-4 py-3">Code</th>
                    <th className="whitespace-nowrap px-4 py-3">Description</th>
                    <th className="whitespace-nowrap px-4 py-3">Qty</th>
                    <th className="whitespace-nowrap px-4 py-3">Unit</th>
                    <th className="whitespace-nowrap px-4 py-3">Unit cost</th>
                    <th className="whitespace-nowrap px-4 py-3">Pricing margin</th>
                    <th className="whitespace-nowrap px-4 py-3">Sell rate</th>
                    <th className="whitespace-nowrap px-4 py-3">Total</th>
                    <th className="whitespace-nowrap px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900">
                      <td className="px-4 py-3 text-slate-200">{item.itemNumber}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.itemCode}
                          onChange={(event) => updateItem(section.id, item.id, "itemCode", event.target.value)}
                          disabled={isReadOnly || actionPending}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(event) => updateItem(section.id, item.id, "description", event.target.value)}
                          disabled={isReadOnly || actionPending}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {item.pricingMetadata && (
                          <p
                            className={`mt-1 text-[10px] uppercase tracking-wide ${
                              item.pricingMetadata.manuallyOverriddenFields.length > 0 ? "text-amber-400" : "text-sky-400"
                            }`}
                            title={`Applied ${formatDate(item.pricingMetadata.rateAppliedAt)} by ${item.pricingMetadata.rateAppliedByName}${
                              item.pricingMetadata.supplierNameSnapshot ? ` · ${item.pricingMetadata.supplierNameSnapshot}` : ""
                            }`}
                          >
                            {item.pricingMetadata.manuallyOverriddenFields.length > 0
                              ? "Catalogue (overridden)"
                              : `Catalogue · ${item.pricingMetadata.catalogueItemCode}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 w-24">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateItem(section.id, item.id, "quantity", Number(event.target.value))}
                          disabled={isReadOnly || actionPending}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="px-4 py-3 w-20">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(event) => updateItem(section.id, item.id, "unit", event.target.value)}
                          disabled={isReadOnly || actionPending}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(event) => updateItem(section.id, item.id, "unitCost", Number(event.target.value))}
                          disabled={isReadOnly || actionPending}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="px-4 py-3 w-24">
                        <div className="space-y-2">
                          <select
                            aria-label={`Pricing mode for item ${item.itemNumber}`}
                            value={normalizeMarginMode(item.marginMode)}
                            onChange={(event) => updateItem(section.id, item.id, "marginMode", event.target.value)}
                            disabled={isReadOnly || actionPending}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="markup">Markup</option>
                            <option value="gross_margin">Gross margin</option>
                          </select>
                          <input
                            aria-label={`Margin percentage for item ${item.itemNumber}`}
                            type="number"
                            step="0.01"
                            value={item.marginPercentage}
                            onChange={(event) => updateItem(section.id, item.id, "marginPercentage", Number(event.target.value))}
                            disabled={isReadOnly || actionPending}
                            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 w-28 text-slate-200">{formatCurrency(item.sellingRate, currency)}</td>
                      <td className="px-4 py-3 w-28 text-slate-200">{formatCurrency(item.totalAmount, currency)}</td>
                      <td className="px-4 py-3 w-24">
                        <div className="flex flex-col gap-2">
                          {onApplyCatalogueRate && industryId && isPersistedItemId(item.id) && (
                            <button
                              type="button"
                              onClick={() => setRateDrawerItemId(item.id)}
                              disabled={isReadOnly || actionPending || isApplyingRate}
                              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Apply rate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteItem(section.id, item.id)}
                            disabled={isReadOnly || actionPending}
                            className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {section.items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                        <p className="mb-4">No items have been added to this section.</p>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => onAddItem && onAddItem()}
                            disabled={actionPending}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Add First Item
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Calculated totals</p>
            <p className="mt-1 text-slate-400">Totals are deterministic and updated from item values.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Subtotal</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totals.subtotal, currency)}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tax</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totals.taxAmount, currency)}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Grand total</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totals.grandTotal, currency)}</p>
            </div>
          </div>
        </div>
      </section>

      {rateError && (
        <div className="rounded-[28px] border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-200" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{rateError}</p>
            <button type="button" onClick={() => setRateError(null)} className="rounded-2xl border border-rose-800 px-3 py-2 font-semibold hover:bg-rose-900/40">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {rateDrawerItemId && industryId && (
        <CatalogueRateDrawer
          industryId={industryId}
          onSelect={(item) => void applyCatalogueRate(item)}
          onClose={() => setRateDrawerItemId(null)}
        />
      )}
    </div>
  );
}
