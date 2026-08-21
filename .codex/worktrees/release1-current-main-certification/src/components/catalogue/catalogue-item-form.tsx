"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { CatalogueItem } from "@/types/catalogue";
import type { Supplier } from "@/types/supplier";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";

type IndustryOption = { id: string; key: string; name: string; enabled: boolean };

type FormValues = {
  industryEngineId: string;
  supplierId: string;
  itemCode: string;
  category: string;
  subcategory: string;
  description: string;
  specification: string;
  unit: string;
  manufacturer: string;
  brand: string;
  model: string;
  countryOfOrigin: string;
  baseCost: string;
  freightCost: string;
  installationCost: string;
  additionalCost: string;
  marginMode: "MARKUP" | "GROSS_MARGIN";
  defaultMargin: string;
  minimumSellingRate: string;
  currency: string;
  effectiveDate: string;
  expiryDate: string;
  sourceReference: string;
  supplierQuotationReference: string;
  changeReason: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function valuesFromItem(item?: CatalogueItem): FormValues {
  if (!item) {
    return {
      industryEngineId: "",
      supplierId: "",
      itemCode: "",
      category: "",
      subcategory: "",
      description: "",
      specification: "",
      unit: "",
      manufacturer: "",
      brand: "",
      model: "",
      countryOfOrigin: "",
      baseCost: "",
      freightCost: "0",
      installationCost: "0",
      additionalCost: "0",
      marginMode: "MARKUP",
      defaultMargin: "0",
      minimumSellingRate: "",
      currency: "AED",
      effectiveDate: today(),
      expiryDate: "",
      sourceReference: "",
      supplierQuotationReference: "",
      changeReason: "",
    };
  }
  return {
    industryEngineId: item.industryId,
    supplierId: item.supplierId ?? "",
    itemCode: item.itemCode,
    category: item.category,
    subcategory: item.subcategory ?? "",
    description: item.description,
    specification: item.specification ?? "",
    unit: item.unit,
    manufacturer: item.manufacturer ?? "",
    brand: item.brand ?? "",
    model: item.model ?? "",
    countryOfOrigin: item.countryOfOrigin ?? "",
    baseCost: String(item.baseCost),
    freightCost: String(item.freightCost),
    installationCost: String(item.installationCost),
    additionalCost: String(item.additionalCost),
    marginMode: item.marginMode === "GROSS_MARGIN" ? "GROSS_MARGIN" : "MARKUP",
    defaultMargin: String(item.defaultMargin),
    minimumSellingRate: item.minimumSellingRate !== null ? String(item.minimumSellingRate) : "",
    currency: item.currency,
    effectiveDate: item.effectiveDate.slice(0, 10),
    expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
    sourceReference: item.sourceReference ?? "",
    supplierQuotationReference: item.supplierQuotationReference ?? "",
    changeReason: "",
  };
}

function previewLandedAndSelling(values: FormValues): { landedCost: number; sellingRate: number } {
  const base = Number(values.baseCost) || 0;
  const freight = Number(values.freightCost) || 0;
  const installation = Number(values.installationCost) || 0;
  const additional = Number(values.additionalCost) || 0;
  const landedCost = base + freight + installation + additional;
  const margin = Number(values.defaultMargin) || 0;
  const sellingRate =
    values.marginMode === "GROSS_MARGIN"
      ? margin < 100
        ? landedCost / (1 - margin / 100)
        : NaN
      : landedCost * (1 + margin / 100);
  return { landedCost, sellingRate };
}

type CatalogueItemFormProps = {
  industries: IndustryOption[];
  suppliers: Supplier[];
  editingItem?: CatalogueItem;
  onSaved: (item: CatalogueItem) => void;
  onCancel?: () => void;
};

export default function CatalogueItemForm({ industries, suppliers, editingItem, onSaved, onCancel }: CatalogueItemFormProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromItem(editingItem));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preview = useMemo(() => previewLandedAndSelling(values), [values]);

  const update = (field: keyof FormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    const payload = {
      industryEngineId: values.industryEngineId,
      supplierId: values.supplierId || null,
      itemCode: values.itemCode,
      category: values.category,
      subcategory: values.subcategory || undefined,
      description: values.description,
      specification: values.specification || undefined,
      unit: values.unit,
      manufacturer: values.manufacturer || undefined,
      brand: values.brand || undefined,
      model: values.model || undefined,
      countryOfOrigin: values.countryOfOrigin || undefined,
      baseCost: values.baseCost,
      freightCost: values.freightCost,
      installationCost: values.installationCost,
      additionalCost: values.additionalCost,
      marginMode: values.marginMode,
      defaultMargin: values.defaultMargin,
      minimumSellingRate: values.minimumSellingRate || null,
      currency: values.currency,
      effectiveDate: values.effectiveDate,
      expiryDate: values.expiryDate || null,
      sourceReference: values.sourceReference || undefined,
      supplierQuotationReference: values.supplierQuotationReference || undefined,
      changeReason: values.changeReason || undefined,
    };
    try {
      const item = editingItem
        ? await apiClient.put<CatalogueItem>(`/api/catalogue/${editingItem.id}`, payload)
        : await apiClient.post<CatalogueItem>("/api/catalogue", payload);
      onSaved(item);
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.fieldErrors) {
        setFieldErrors(submitError.fieldErrors);
      }
      setFormError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Industry engine</span>
          <select className={inputClass} value={values.industryEngineId} onChange={update("industryEngineId")} required>
            <option value="" disabled>Select an industry engine</option>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.key}>{industry.name}</option>
            ))}
          </select>
          {fieldErrors.industryEngineId && <p className="mt-2 text-xs text-rose-400">{fieldErrors.industryEngineId[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Supplier</span>
          <select className={inputClass} value={values.supplierId} onChange={update("supplierId")}>
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Item code</span>
          <input className={inputClass} value={values.itemCode} onChange={update("itemCode")} required />
          {fieldErrors.itemCode && <p className="mt-2 text-xs text-rose-400">{fieldErrors.itemCode[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Category</span>
          <input className={inputClass} value={values.category} onChange={update("category")} required />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Subcategory</span>
          <input className={inputClass} value={values.subcategory} onChange={update("subcategory")} />
        </label>
      </div>

      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">Description</span>
        <input className={inputClass} value={values.description} onChange={update("description")} required />
      </label>
      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">Specification</span>
        <textarea className={`${inputClass} min-h-[80px]`} value={values.specification} onChange={update("specification")} />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Unit</span>
          <input className={inputClass} value={values.unit} onChange={update("unit")} required />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Manufacturer</span>
          <input className={inputClass} value={values.manufacturer} onChange={update("manufacturer")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Brand</span>
          <input className={inputClass} value={values.brand} onChange={update("brand")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Model</span>
          <input className={inputClass} value={values.model} onChange={update("model")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Base cost</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.baseCost} onChange={update("baseCost")} required />
          {fieldErrors.baseCost && <p className="mt-2 text-xs text-rose-400">{fieldErrors.baseCost[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Freight cost</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.freightCost} onChange={update("freightCost")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Installation cost</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.installationCost} onChange={update("installationCost")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Additional cost</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.additionalCost} onChange={update("additionalCost")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Margin mode</span>
          <select className={inputClass} value={values.marginMode} onChange={update("marginMode")}>
            <option value="MARKUP">Markup</option>
            <option value="GROSS_MARGIN">Gross margin</option>
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Default margin (%)</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.defaultMargin} onChange={update("defaultMargin")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Minimum selling rate</span>
          <input type="number" step="0.01" min="0" className={inputClass} value={values.minimumSellingRate} onChange={update("minimumSellingRate")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Currency</span>
          <input className={inputClass} value={values.currency} onChange={update("currency")} required />
        </label>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Landed cost (calculated)</p>
          <p className="mt-1 text-lg font-semibold text-white">{preview.landedCost.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selling rate (calculated)</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {Number.isFinite(preview.sellingRate) ? preview.sellingRate.toFixed(2) : "Invalid margin"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Server recalculates on save</p>
          <p className="mt-1 text-xs text-slate-500">This preview is for usability only; the server is the source of truth.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Effective date</span>
          <input type="date" className={inputClass} value={values.effectiveDate} onChange={update("effectiveDate")} required />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Expiry date</span>
          <input type="date" className={inputClass} value={values.expiryDate} onChange={update("expiryDate")} />
          {fieldErrors.expiryDate && <p className="mt-2 text-xs text-rose-400">{fieldErrors.expiryDate[0]}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Source reference</span>
          <input className={inputClass} value={values.sourceReference} onChange={update("sourceReference")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Supplier quotation reference</span>
          <input className={inputClass} value={values.supplierQuotationReference} onChange={update("supplierQuotationReference")} />
        </label>
      </div>

      {editingItem && (
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Change reason (recorded in price history if pricing changed)</span>
          <input className={inputClass} value={values.changeReason} onChange={update("changeReason")} />
        </label>
      )}

      {formError && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">{formError}</div>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800">
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
          {isSubmitting ? "Saving..." : editingItem ? "Save changes" : "Add rate"}
        </button>
      </div>
    </form>
  );
}
