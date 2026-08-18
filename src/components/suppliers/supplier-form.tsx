"use client";

import { useState, type FormEvent } from "react";
import type { Supplier } from "@/types/supplier";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

type SupplierFormValues = {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  contactPerson: string;
  taxRegistrationNumber: string;
  defaultCurrency: string;
  paymentTerms: string;
  leadTimeDays: string;
  notes: string;
};

const EMPTY_VALUES: SupplierFormValues = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  contactPerson: "",
  taxRegistrationNumber: "",
  defaultCurrency: "AED",
  paymentTerms: "",
  leadTimeDays: "",
  notes: "",
};

function valuesFromSupplier(supplier?: Supplier): SupplierFormValues {
  if (!supplier) return EMPTY_VALUES;
  return {
    name: supplier.name,
    legalName: supplier.legalName ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    website: supplier.website ?? "",
    address: supplier.address ?? "",
    contactPerson: supplier.contactPerson ?? "",
    taxRegistrationNumber: supplier.taxRegistrationNumber ?? "",
    defaultCurrency: supplier.defaultCurrency,
    paymentTerms: supplier.paymentTerms ?? "",
    leadTimeDays: supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : "",
    notes: supplier.notes ?? "",
  };
}

type SupplierFormProps = {
  onSaved: (supplier: Supplier) => void;
  onCancel?: () => void;
  editingSupplier?: Supplier;
  compact?: boolean;
};

export default function SupplierForm({ onSaved, onCancel, editingSupplier, compact = false }: SupplierFormProps) {
  const t = useTranslations();
  const [values, setValues] = useState<SupplierFormValues>(() => valuesFromSupplier(editingSupplier));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existingSupplier, setExistingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof SupplierFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setExistingSupplier(null);
    const payload = {
      ...values,
      leadTimeDays: values.leadTimeDays.trim() ? Number(values.leadTimeDays) : null,
    };
    try {
      const supplier = editingSupplier
        ? await apiClient.put<Supplier>(`/api/suppliers/${editingSupplier.id}`, payload)
        : await apiClient.post<Supplier>("/api/suppliers", payload);
      if (!editingSupplier) setValues(EMPTY_VALUES);
      onSaved(supplier);
    } catch (submitError) {
      if (submitError instanceof ApiClientError) {
        if (submitError.fieldErrors) setFieldErrors(submitError.fieldErrors);
        if (submitError.code === "SUPPLIER_ALREADY_EXISTS") {
          setFormError(t("suppliers.form.alreadyExists"));
          try {
            const matches = await apiClient.get<{ items: Supplier[] }>(
              `/api/suppliers?search=${encodeURIComponent(values.name.trim())}`,
            );
            setExistingSupplier(matches.items[0] ?? null);
          } catch {
            // Non-fatal: the conflict message alone is still useful without the lookup.
          }
        } else {
          setFormError(submitError.message);
        }
      } else {
        setFormError(getApiErrorMessage(submitError));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-6 rounded-[32px] border border-slate-800 bg-slate-950 p-6"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.supplierNameLabel")}</span>
          <input className={inputClass} value={values.name} onChange={update("name")} required />
          {fieldErrors.name && <p className="mt-2 text-xs text-rose-400">{fieldErrors.name[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.legalNameLabel")}</span>
          <input className={inputClass} value={values.legalName} onChange={update("legalName")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.emailLabel")}</span>
          <input type="email" className={inputClass} value={values.email} onChange={update("email")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.phoneLabel")}</span>
          <input className={inputClass} value={values.phone} onChange={update("phone")} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.contactPersonLabel")}</span>
          <input className={inputClass} value={values.contactPerson} onChange={update("contactPerson")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.websiteLabel")}</span>
          <input className={inputClass} value={values.website} onChange={update("website")} />
        </label>
      </div>

      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">{t("suppliers.form.addressLabel")}</span>
        <input className={inputClass} value={values.address} onChange={update("address")} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.taxRegistrationNumberLabel")}</span>
          <input className={inputClass} value={values.taxRegistrationNumber} onChange={update("taxRegistrationNumber")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.defaultCurrencyLabel")}</span>
          <input className={inputClass} value={values.defaultCurrency} onChange={update("defaultCurrency")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">{t("suppliers.form.leadTimeDaysLabel")}</span>
          <input type="number" min={0} className={inputClass} value={values.leadTimeDays} onChange={update("leadTimeDays")} />
        </label>
      </div>

      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">{t("suppliers.form.paymentTermsLabel")}</span>
        <input className={inputClass} value={values.paymentTerms} onChange={update("paymentTerms")} />
      </label>

      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">{t("suppliers.form.notesLabel")}</span>
        <textarea className={`${inputClass} min-h-[100px]`} value={values.notes} onChange={update("notes")} />
      </label>

      {formError && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
          <p>{formError}</p>
          {existingSupplier && (
            <button
              type="button"
              onClick={() => onSaved(existingSupplier)}
              className="mt-2 inline-flex rounded-2xl border border-rose-700 bg-rose-900/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900"
            >
              {t("suppliers.form.useInstead", { name: existingSupplier.name })}
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t("suppliers.form.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {isSubmitting ? t("suppliers.form.saving") : editingSupplier ? t("suppliers.form.saveChanges") : t("suppliers.form.saveSupplier")}
        </button>
      </div>
    </form>
  );
}
