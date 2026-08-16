"use client";

import { useState, type FormEvent } from "react";
import type { Client, ClientListResult } from "@/types/client";
import { ApiClientError, apiClient, getApiErrorMessage } from "@/lib/api/client";

type ClientFormValues = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  taxRegistrationNumber: string;
  notes: string;
};

const EMPTY_VALUES: ClientFormValues = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  address: "",
  taxRegistrationNumber: "",
  notes: "",
};

type ClientFormProps = {
  onCreated: (client: Client) => void;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
  editingClient?: Client;
};

function valuesFromClient(client?: Client): ClientFormValues {
  if (!client) return EMPTY_VALUES;
  return {
    name: client.name,
    companyName: client.companyName ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    taxRegistrationNumber: client.taxRegistrationNumber ?? "",
    notes: client.notes ?? "",
  };
}

export default function ClientForm({
  onCreated,
  onCancel,
  submitLabel,
  compact = false,
  editingClient,
}: ClientFormProps) {
  const [values, setValues] = useState<ClientFormValues>(() => valuesFromClient(editingClient));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existingClient, setExistingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof ClientFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setExistingClient(null);
    try {
      const client = editingClient
        ? await apiClient.put<Client>(`/api/clients/${editingClient.id}`, values)
        : await apiClient.post<Client>("/api/clients", values);
      if (!editingClient) setValues(EMPTY_VALUES);
      onCreated(client);
    } catch (submitError) {
      if (submitError instanceof ApiClientError) {
        if (submitError.fieldErrors) setFieldErrors(submitError.fieldErrors);
        if (submitError.code === "CLIENT_ALREADY_EXISTS") {
          setFormError("A client matching this email already exists.");
          if (values.email.trim()) {
            try {
              const matches = await apiClient.get<ClientListResult>(
                `/api/clients?search=${encodeURIComponent(values.email.trim())}`,
              );
              setExistingClient(matches.items[0] ?? null);
            } catch {
              // Non-fatal: the conflict message alone is still useful without the lookup.
            }
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
  const resolvedSubmitLabel = submitLabel ?? (editingClient ? "Save changes" : "Save client");

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-6 rounded-[32px] border border-slate-800 bg-slate-950 p-6"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Client / contact name (optional)</span>
          <input className={inputClass} value={values.name} onChange={update("name")} />
          {fieldErrors.name && <p className="mt-2 text-xs text-rose-400">{fieldErrors.name[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Company name</span>
          <input className={inputClass} value={values.companyName} onChange={update("companyName")} required />
          {fieldErrors.companyName && <p className="mt-2 text-xs text-rose-400">{fieldErrors.companyName[0]}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Email</span>
          <input type="email" className={inputClass} value={values.email} onChange={update("email")} required />
          {fieldErrors.email && <p className="mt-2 text-xs text-rose-400">{fieldErrors.email[0]}</p>}
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Phone</span>
          <input type="tel" className={inputClass} value={values.phone} onChange={update("phone")} required />
          {fieldErrors.phone && <p className="mt-2 text-xs text-rose-400">{fieldErrors.phone[0]}</p>}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Address (optional)</span>
          <input className={inputClass} value={values.address} onChange={update("address")} />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Tax registration number (optional)</span>
          <input className={inputClass} value={values.taxRegistrationNumber} onChange={update("taxRegistrationNumber")} />
        </label>
      </div>

      <label className="block text-sm text-slate-300">
        <span className="text-slate-400">Notes (optional)</span>
        <textarea className={`${inputClass} min-h-[100px]`} value={values.notes} onChange={update("notes")} />
      </label>

      {formError && (
        <div className="rounded-2xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
          <p>{formError}</p>
          {existingClient && (
            <button
              type="button"
              onClick={() => onCreated(existingClient)}
              className="mt-2 inline-flex rounded-2xl border border-rose-700 bg-rose-900/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900"
            >
              Use {existingClient.name} instead
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
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : resolvedSubmitLabel}
        </button>
      </div>
    </form>
  );
}
