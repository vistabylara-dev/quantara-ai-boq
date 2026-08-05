"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type CommerceProductType = "SUBSCRIPTION" | "ONE_TIME" | "INDUSTRY_ACCESS" | "AI_CREDIT_PACK" | "ADD_ON" | "ENTERPRISE";
type CommercePurchaseMode = "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
type CommerceBillingInterval = "ONE_TIME" | "MONTH" | "YEAR";

type PriceRow = {
  id: string;
  code: string;
  amountMinor: number;
  currency: "AED";
  billingInterval: CommerceBillingInterval;
  isFromPrice: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
};

type EntitlementTemplateRow = {
  id: string;
  maxUsers: number | null;
  maxWorkspaces: number | null;
  maxActiveProjects: number | null;
  maxBoqGenerationsPerMonth: number | null;
  maxTechnicalReportsPerMonth: number | null;
  maxWatermarkFreeExportsPerMonth: number | null;
  permittedExportFormats: string[];
  removesWatermark: boolean;
  allowsCompanyBranding: boolean;
  allowsApiAccess: boolean;
  allowsWhiteLabel: boolean;
  industryPackageKeys: string[];
  aiCreditsGranted: number | null;
  downloadLimit: number | null;
  entitlementDurationDays: number | null;
};

type ProductRow = {
  id: string;
  code: string;
  type: CommerceProductType;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: CommercePurchaseMode;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  industryPackage: { id: string; key: string; name: string; status: string } | null;
  prices: PriceRow[];
  entitlementTemplate: EntitlementTemplateRow | null;
  createdAt: string;
  updatedAt: string;
};

const TYPE_LABELS: Record<CommerceProductType, string> = {
  SUBSCRIPTION: "Subscription",
  ONE_TIME: "One-time",
  INDUSTRY_ACCESS: "Industry access",
  AI_CREDIT_PACK: "AI credit pack",
  ADD_ON: "Add-on",
  ENTERPRISE: "Enterprise",
};

const PURCHASE_MODE_LABELS: Record<CommercePurchaseMode, string> = {
  DIRECT: "Direct",
  QUOTATION_REQUIRED: "Quotation required",
  CONTACT_SALES: "Contact sales",
};

const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";

function formatAed(amountMinor: number): string {
  return `AED ${(amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function TypeBadge({ type }: { type: CommerceProductType }) {
  return <span className="rounded-full border border-[#D9E2EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#536078] dark:border-[#1E2A42] dark:text-[#7F8DA6]">{TYPE_LABELS[type]}</span>;
}

export default function AdminCommerceCentre() {
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const data = await apiClient.get<ProductRow[]>("/api/admin/commerce/products", signal);
      setRows(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadList(controller.signal);
    return () => controller.abort();
  }, [loadList]);

  const selected = useMemo(() => rows?.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const totals = useMemo(() => {
    if (!rows) return null;
    const byType = (t: CommerceProductType) => rows.filter((r) => r.type === t).length;
    return {
      total: rows.length,
      subscription: byType("SUBSCRIPTION"),
      oneTime: byType("ONE_TIME"),
      industryAccess: byType("INDUSTRY_ACCESS"),
      aiCreditPack: byType("AI_CREDIT_PACK"),
      addOn: byType("ADD_ON"),
      enterprise: byType("ENTERPRISE"),
      active: rows.filter((r) => r.isActive).length,
      inactive: rows.filter((r) => !r.isActive).length,
      public: rows.filter((r) => r.isPublic).length,
      private: rows.filter((r) => !r.isPublic).length,
      direct: rows.filter((r) => r.purchaseMode === "DIRECT").length,
      quotationOrSales: rows.filter((r) => r.purchaseMode !== "DIRECT").length,
    };
  }, [rows]);

  const updateState = useCallback(async (productId: string, patch: { isActive?: boolean; isPublic?: boolean }) => {
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await apiClient.patch(`/api/admin/commerce/products/${productId}`, patch);
      setActionMessage("Product updated.");
      await loadList();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [loadList]);

  return (
    <div className="space-y-6">
      <header className={panel}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <ShoppingBag className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Commerce Centre</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Owner-only. The internal AED product/price/entitlement catalogue seeded for STRIPE-1B.
          <strong className="font-semibold"> Stripe checkout is not connected yet</strong> — nothing here can be purchased by a
          customer, no order/invoice/payment record exists, and the figures below are catalogue data, not real sales or revenue.
        </p>
      </header>

      {totals && (
        <div className={panel}>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Total products" value={totals.total} />
            <Stat label="Subscription" value={totals.subscription} />
            <Stat label="One-time" value={totals.oneTime} />
            <Stat label="Industry access" value={totals.industryAccess} />
            <Stat label="AI credit packs" value={totals.aiCreditPack} />
            <Stat label="Add-ons" value={totals.addOn} />
            <Stat label="Enterprise" value={totals.enterprise} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="Active / inactive" value={`${totals.active} / ${totals.inactive}`} />
            <Stat label="Public / private" value={`${totals.public} / ${totals.private}`} />
            <Stat label="Direct / quotation-sales" value={`${totals.direct} / ${totals.quotationOrSales}`} />
          </div>
        </div>
      )}

      {(actionMessage || actionError) && (
        <div className={`rounded-2xl border p-4 text-sm ${actionError ? "border-[#D84A4A]/40 bg-[#D84A4A]/10 text-[#D84A4A] dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" : "border-[#159A6A]/40 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
          {actionError ?? actionMessage}
        </div>
      )}

      {loadError && (
        <div className={panel}>
          <p className="text-sm text-[#D84A4A] dark:text-rose-300">Commerce catalogue unavailable: {loadError}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${panel} lg:col-span-3`}>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Products ({rows?.length ?? 0})</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Prices</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {rows?.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-t border-[#D9E2EC] dark:border-[#1E2A42] ${selectedId === row.id ? "bg-[#EEF3F8] dark:bg-[#111D33]" : "hover:bg-[#F7FAFC] dark:hover:bg-[#0F1B33]"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{row.code}</p>
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
                    <td className="px-4 py-3">
                      {row.prices.length === 0 && <span className="text-[#7B879C] dark:text-[#7F8DA6]">none</span>}
                      {row.prices.filter((p) => p.isActive).map((p) => (
                        <span key={p.id} className="mr-2 inline-block">
                          {p.isFromPrice ? "from " : ""}{formatAed(p.amountMinor)}{p.billingInterval === "ONE_TIME" ? "" : p.billingInterval === "MONTH" ? "/mo" : "/yr"}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={row.isActive ? "text-[#159A6A] dark:text-emerald-300" : "text-[#D84A4A] dark:text-rose-300"}>{row.isActive ? "Active" : "Inactive"}</span>
                      {" · "}
                      <span className={row.isPublic ? "text-[#0284C7] dark:text-[#22D3EE]" : "text-[#7B879C] dark:text-[#7F8DA6]"}>{row.isPublic ? "Public" : "Private"}</span>
                    </td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[#7B879C] dark:text-[#7F8DA6]">No commerce products exist yet — run the catalogue seed.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${panel} lg:col-span-2`}>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Product detail</p>
          {!selected && <p className="mt-2 text-sm text-[#7B879C] dark:text-[#7F8DA6]">Select a product on the left to inspect it.</p>}
          {selected && (
            <div className="mt-3 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-[#0B1630] dark:text-white">{selected.name}</p>
                <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{selected.code} · {PURCHASE_MODE_LABELS[selected.purchaseMode]}</p>
                <p className="mt-2 text-[#536078] dark:text-[#B8C4D8]">{selected.description}</p>
              </div>

              {selected.industryPackage && (
                <div className="rounded-xl border border-[#D9E2EC] p-3 text-xs dark:border-[#1E2A42]">
                  <p className="font-semibold text-[#0B1630] dark:text-white">Catalogue availability</p>
                  <p className="mt-1 text-[#536078] dark:text-[#B8C4D8]">
                    Linked to industry package &ldquo;{selected.industryPackage.name}&rdquo; ({selected.industryPackage.key}) —
                    {selected.industryPackage.status === "ACTIVE" ? " available." : ` not currently available (${selected.industryPackage.status}).`}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#536078] dark:text-[#7F8DA6]">Prices</p>
                <ul className="mt-2 space-y-1.5">
                  {selected.prices.map((p) => (
                    <li key={p.id} className={`rounded-lg border border-[#D9E2EC] p-2 text-xs dark:border-[#1E2A42] ${!p.isActive ? "opacity-50" : ""}`}>
                      <span className="font-semibold">{p.isFromPrice ? "from " : ""}{formatAed(p.amountMinor)}</span>
                      {" "}
                      <span className="text-[#7B879C] dark:text-[#7F8DA6]">
                        {p.billingInterval === "ONE_TIME" ? "one-time" : p.billingInterval === "MONTH" ? "per month" : "per year"} · {p.code} · {p.isActive ? "active" : "archived"}
                      </span>
                    </li>
                  ))}
                  {selected.prices.length === 0 && <li className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">No prices configured.</li>}
                </ul>
              </div>

              {selected.entitlementTemplate && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#536078] dark:text-[#7F8DA6]">Entitlement template</p>
                  <div className="mt-2 rounded-xl border border-dashed border-[#D9E2EC] p-3 text-xs dark:border-[#1E2A42]">
                    <p className="text-[#B4841F] dark:text-[#E0B25C]">
                      Every field below is a commercial grant recorded for this product. None of them are enforced by the
                      application yet — no purchase-fulfilment path exists to apply them to a real company.
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[#536078] dark:text-[#B8C4D8]">
                      <EntitlementField label="Max users" value={selected.entitlementTemplate.maxUsers} />
                      <EntitlementField label="Max workspaces" value={selected.entitlementTemplate.maxWorkspaces} />
                      <EntitlementField label="Max active projects" value={selected.entitlementTemplate.maxActiveProjects} />
                      <EntitlementField label="Max BOQs/mo" value={selected.entitlementTemplate.maxBoqGenerationsPerMonth} />
                      <EntitlementField label="Max reports/mo" value={selected.entitlementTemplate.maxTechnicalReportsPerMonth} />
                      <EntitlementField label="Watermark-free exports/mo" value={selected.entitlementTemplate.maxWatermarkFreeExportsPerMonth} />
                      <EntitlementField label="Download limit" value={selected.entitlementTemplate.downloadLimit} />
                      <EntitlementField label="AI credits granted" value={selected.entitlementTemplate.aiCreditsGranted} />
                      <EntitlementField label="Duration (days)" value={selected.entitlementTemplate.entitlementDurationDays} />
                      <EntitlementField label="Removes watermark" value={selected.entitlementTemplate.removesWatermark ? "yes" : "no"} />
                      <EntitlementField label="Company branding" value={selected.entitlementTemplate.allowsCompanyBranding ? "yes" : "no"} />
                      <EntitlementField label="API access" value={selected.entitlementTemplate.allowsApiAccess ? "yes" : "no"} />
                      <EntitlementField label="White label" value={selected.entitlementTemplate.allowsWhiteLabel ? "yes" : "no"} />
                    </dl>
                    {selected.entitlementTemplate.industryPackageKeys.length > 0 && (
                      <p className="mt-2 text-[#536078] dark:text-[#B8C4D8]">Industry packages: {selected.entitlementTemplate.industryPackageKeys.join(", ")}</p>
                    )}
                    {selected.entitlementTemplate.permittedExportFormats.length > 0 && (
                      <p className="mt-1 text-[#536078] dark:text-[#B8C4D8]">Export formats: {selected.entitlementTemplate.permittedExportFormats.join(", ")}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[#D9E2EC] pt-3 dark:border-[#1E2A42]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateState(selected.id, { isActive: !selected.isActive })}
                  className="rounded-lg border border-[#D9E2EC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                >
                  {selected.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateState(selected.id, { isPublic: !selected.isPublic })}
                  className="rounded-lg border border-[#D9E2EC] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]"
                >
                  {selected.isPublic ? "Make private" : "Make public"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-[#0B1630] dark:text-white">{value}</p>
      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{label}</p>
    </div>
  );
}

function EntitlementField({ label, value }: { label: string; value: number | string | null }) {
  return (
    <>
      <dt className="text-[#7B879C] dark:text-[#7F8DA6]">{label}</dt>
      <dd className="text-right font-medium">{value === null ? "unlimited" : value}</dd>
    </>
  );
}
