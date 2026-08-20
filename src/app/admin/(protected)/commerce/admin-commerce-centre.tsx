"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type CommerceProductType = "SUBSCRIPTION" | "ONE_TIME" | "INDUSTRY_ACCESS" | "AI_CREDIT_PACK" | "ADD_ON" | "ENTERPRISE";
type CommercePurchaseMode = "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";
type CommerceBillingInterval = "ONE_TIME" | "MONTH" | "YEAR";

type CommercePriceReviewStatus = "DRAFT" | "REQUIRES_REVIEW" | "APPROVED" | "RETIRED";

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
  reviewStatus: CommercePriceReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
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

const REVIEW_STATUS_LABELS: Record<CommercePriceReviewStatus, string> = {
  DRAFT: "Draft",
  REQUIRES_REVIEW: "Requires review",
  APPROVED: "Approved",
  RETIRED: "Retired",
};

const REVIEW_STATUS_TONE: Record<CommercePriceReviewStatus, string> = {
  DRAFT: "text-[#7B879C] dark:text-[#7F8DA6]",
  REQUIRES_REVIEW: "text-[#B4841F] dark:text-[#E0B25C]",
  APPROVED: "text-[#159A6A] dark:text-emerald-300",
  RETIRED: "text-[#D84A4A] dark:text-rose-300",
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
  // STRIPE-COMMERCIAL — the /admin/(protected) layout already restricts this
  // entire page to PLATFORM_OWNER server-side (requirePlatformActor redirects
  // anyone else to /dashboard before this component ever mounts), same as
  // every other route under /admin/(protected). This client-side check is
  // defense-in-depth against the live-money panel below ever rendering for a
  // non-owner if that layout policy changes — same actor-role source
  // (/api/auth/session -> session.user.platformRole) admin-dashboard.tsx
  // already uses for its own role-gated UI, not a new auth check.
  const [viewerIsPlatformOwner, setViewerIsPlatformOwner] = useState(false);

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
    apiClient
      .get<{ authenticated: boolean; user: { platformRole: string | null } | null }>("/api/auth/session", controller.signal)
      .then((session) => setViewerIsPlatformOwner(session.authenticated && session.user?.platformRole === "PLATFORM_OWNER"))
      .catch(() => setViewerIsPlatformOwner(false));
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

  const setPriceReview = useCallback(async (priceId: string, reviewStatus: CommercePriceReviewStatus) => {
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await apiClient.patch(`/api/admin/commerce/prices/${priceId}/approval`, { reviewStatus });
      setActionMessage(`Price marked ${REVIEW_STATUS_LABELS[reviewStatus]}.`);
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
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold">{p.isFromPrice ? "from " : ""}{formatAed(p.amountMinor)}</span>
                          {" "}
                          <span className="text-[#7B879C] dark:text-[#7F8DA6]">
                            {p.billingInterval === "ONE_TIME" ? "one-time" : p.billingInterval === "MONTH" ? "per month" : "per year"} · {p.code} · {p.isActive ? "active" : "archived"}
                          </span>
                        </div>
                        <span className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${REVIEW_STATUS_TONE[p.reviewStatus]}`}>
                          {REVIEW_STATUS_LABELS[p.reviewStatus]}
                        </span>
                      </div>
                      {p.reviewNote && <p className="mt-1 text-[#7B879C] dark:text-[#7F8DA6]">Note: {p.reviewNote}</p>}
                      <div className="mt-1.5 flex gap-1.5">
                        {p.reviewStatus !== "APPROVED" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setPriceReview(p.id, "APPROVED")}
                            className="rounded border border-[#159A6A]/40 bg-[#159A6A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#159A6A] hover:bg-[#159A6A]/20 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            Approve
                          </button>
                        )}
                        {p.reviewStatus === "APPROVED" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setPriceReview(p.id, "REQUIRES_REVIEW")}
                            className="rounded border border-[#D9E2EC] px-2 py-0.5 text-[10px] font-semibold text-[#536078] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:text-[#7F8DA6] dark:hover:bg-[#111D33]"
                          >
                            Revert to review
                          </button>
                        )}
                      </div>
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

      <StripeSyncPanel busy={busy} setBusy={setBusy} setActionMessage={setActionMessage} setActionError={setActionError} />

      {viewerIsPlatformOwner && (
        <LiveStripeSyncPanel busy={busy} setBusy={setBusy} setActionMessage={setActionMessage} setActionError={setActionError} />
      )}
    </div>
  );
}

type StripeStatus = {
  configured: boolean;
  mode: "test" | "unset" | "invalid";
  testMode: boolean;
  accountReachable: boolean;
  lastVerifiedAt: string | null;
  synchronizationEnabled: boolean;
  productMappings: number;
  priceMappings: number;
  approvedPriceCount: number;
  reviewRequiredCount: number;
};

type SyncPlan = {
  catalogueFingerprint: string;
  productCount: number;
  approvedPriceCount: number;
  reviewRequiredPriceCount: number;
  productsToCreate: number;
  productsToUpdate: number;
  productsUnchanged: number;
  productsToArchive: number;
  pricesToCreate: number;
  pricesUnchanged: number;
  pricesToArchive: number;
  blockedCount: number;
  prices: Array<{ priceId: string; code: string; productCode: string; action: string; blockedReason?: string }>;
};

type SyncRun = {
  id: string;
  operation: "DRY_RUN" | "SYNCHRONIZE" | "VERIFY";
  status: string;
  dryRun: boolean;
  productsCreated: number;
  productsUpdated: number;
  productsArchived: number;
  pricesCreated: number;
  pricesArchived: number;
  blockedCount: number;
  warningCount: number;
  startedAt: string;
  completedAt: string | null;
};

type DriftEntry = { mappingId: string; providerObjectType: string; code: string; field: string; internalValue: string; providerValue: string };

function StripeSyncPanel({
  busy,
  setBusy,
  setActionMessage,
  setActionError,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setActionMessage: (v: string | null) => void;
  setActionError: (v: string | null) => void;
}) {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [history, setHistory] = useState<SyncRun[] | null>(null);
  const [drift, setDrift] = useState<DriftEntry[] | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await apiClient.get<StripeStatus>("/api/admin/commerce/stripe/status"));
    } catch (error) {
      setStatusError(getApiErrorMessage(error));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await apiClient.get<SyncRun[]>("/api/admin/commerce/stripe/history"));
    } catch {
      // History is supplementary — a failed load here doesn't block the rest of the panel.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadHistory();
  }, [loadStatus, loadHistory]);

  const runDryRun = useCallback(async () => {
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await apiClient.post<{ plan: SyncPlan; run: SyncRun }>("/api/admin/commerce/stripe/dry-run", {});
      setPlan(result.plan);
      setActionMessage("Dry run complete — review the plan below before synchronizing.");
      await loadHistory();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [setBusy, setActionMessage, setActionError, loadHistory]);

  const runSynchronize = useCallback(async () => {
    if (!plan) return;
    if (!window.confirm(`Synchronize ${plan.pricesToCreate} price(s) and ${plan.productsToCreate + plan.productsToUpdate} product(s) to Stripe TEST mode? This will make real Stripe API calls (no money is ever collected).`)) return;
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await apiClient.post<{ run: SyncRun; errors: string[] }>("/api/admin/commerce/stripe/synchronize", {
        catalogueFingerprint: plan.catalogueFingerprint,
        confirm: true,
      });
      setActionMessage(result.errors.length > 0 ? `Synchronized with ${result.errors.length} warning(s) — see history.` : "Synchronization complete.");
      setPlan(null);
      await Promise.all([loadStatus(), loadHistory()]);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [plan, setBusy, setActionMessage, setActionError, loadStatus, loadHistory]);

  const runVerify = useCallback(async () => {
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await apiClient.post<{ verified: number; errored: number; drift: DriftEntry[] }>("/api/admin/commerce/stripe/verify", {});
      setDrift(result.drift);
      setActionMessage(`Verified ${result.verified} mapping(s) — ${result.drift.length} drift warning(s), ${result.errored} unreachable.`);
      await loadHistory();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [setBusy, setActionMessage, setActionError, loadHistory]);

  const lastCompleted = history?.find((h) => h.operation === "SYNCHRONIZE" && (h.status === "COMPLETED" || h.status === "COMPLETED_WITH_WARNINGS"));
  const lastFailed = history?.find((h) => h.operation === "SYNCHRONIZE" && h.status === "FAILED");

  return (
    <section className={panel}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Stripe Synchronization</p>
        {status && (
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${status.testMode ? "border-[#159A6A]/40 bg-[#159A6A]/10 text-[#159A6A] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-[#D9E2EC] text-[#7B879C] dark:border-[#1E2A42] dark:text-[#7F8DA6]"}`}>
            {status.configured ? (status.accountReachable ? "Test Mode Connected" : "Test Mode — Unreachable") : "Not Connected"}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-[#536078] dark:text-[#B8C4D8]">
        Mode: TEST only. No checkout, no payment collection, no customer or subscription is ever created by this panel.
      </p>

      {statusError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{statusError}</p>}

      {status && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Mapped products" value={status.productMappings} />
          <Stat label="Mapped prices" value={status.priceMappings} />
          <Stat label="Approved prices" value={status.approvedPriceCount} />
          <Stat label="Review-required" value={status.reviewRequiredCount} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-[#536078] dark:text-[#B8C4D8] sm:grid-cols-2">
        <p>Last successful sync: {lastCompleted ? new Date(lastCompleted.completedAt ?? lastCompleted.startedAt).toLocaleString() : "never"}</p>
        <p>Last failed sync: {lastFailed ? new Date(lastFailed.startedAt).toLocaleString() : "none"}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#D9E2EC] pt-4 dark:border-[#1E2A42]">
        <button type="button" disabled={busy} onClick={() => void runDryRun()} className="rounded-lg border border-[#0EA5E9] bg-[#0EA5E9] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
          Run dry run
        </button>
        <button type="button" disabled={busy || !plan} onClick={() => void runSynchronize()} className="rounded-lg border border-[#159A6A] bg-[#159A6A] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          Synchronize approved items
        </button>
        <button type="button" disabled={busy} onClick={() => void runVerify()} className="rounded-lg border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white dark:hover:bg-[#111D33]">
          Verify mappings
        </button>
      </div>

      {plan && (
        <div className="mt-4 rounded-2xl border border-[#D9E2EC] p-4 text-xs dark:border-[#1E2A42]">
          <p className="font-semibold text-[#0B1630] dark:text-white">Synchronization plan</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <p>Products to create: <strong>{plan.productsToCreate}</strong></p>
            <p>Products to update: <strong>{plan.productsToUpdate}</strong></p>
            <p>Products unchanged: <strong>{plan.productsUnchanged}</strong></p>
            <p>Products to archive: <strong>{plan.productsToArchive}</strong></p>
            <p>Prices to create: <strong>{plan.pricesToCreate}</strong></p>
            <p>Prices unchanged: <strong>{plan.pricesUnchanged}</strong></p>
            <p>Prices to archive: <strong>{plan.pricesToArchive}</strong></p>
            <p>Blocked: <strong>{plan.blockedCount}</strong></p>
          </div>
          {plan.prices.some((p) => p.action === "BLOCKED") && (
            <div className="mt-3">
              <p className="font-semibold text-[#B4841F] dark:text-[#E0B25C]">Blocked prices</p>
              <ul className="mt-1 space-y-0.5 text-[#536078] dark:text-[#B8C4D8]">
                {plan.prices.filter((p) => p.action === "BLOCKED").map((p) => (
                  <li key={p.priceId}>{p.productCode} / {p.code} — {p.blockedReason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {drift && drift.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[#D84A4A]/40 bg-[#D84A4A]/5 p-4 text-xs dark:border-rose-900 dark:bg-rose-950/20">
          <p className="font-semibold text-[#D84A4A] dark:text-rose-300">Drift warnings — internal values were NOT changed</p>
          <ul className="mt-1 space-y-0.5 text-[#536078] dark:text-[#B8C4D8]">
            {drift.map((d, i) => (
              <li key={`${d.mappingId}-${d.field}-${i}`}>{d.code} · {d.field}: internal={d.internalValue}, Stripe={d.providerValue}</li>
            ))}
          </ul>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#536078] dark:text-[#7F8DA6]">History</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-3 py-2">Operation</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Archived</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {history.slice(0, 10).map((h) => (
                  <tr key={h.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                    <td className="px-3 py-2">{h.operation}{h.dryRun ? " (dry run)" : ""}</td>
                    <td className="px-3 py-2">{h.status}</td>
                    <td className="px-3 py-2">{h.productsCreated + h.pricesCreated}</td>
                    <td className="px-3 py-2">{h.productsArchived + h.pricesArchived}</td>
                    <td className="px-3 py-2">{h.blockedCount}</td>
                    <td className="px-3 py-2">{new Date(h.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type LiveSyncPlan = {
  catalogueFingerprint: string;
  productsToCreate: number;
  productsToUpdate: number;
  productsUnchanged: number;
  productsToArchive: number;
  pricesToCreate: number;
  pricesToReactivate: number;
  pricesUnchanged: number;
  pricesToArchive: number;
  blockedCount: number;
  prices: Array<{ priceId: string; code: string; productCode: string; action: string; blockedReason?: string }>;
};

/**
 * STRIPE-COMMERCIAL-4 UI — the backend (runLiveDryRun/synchronizeLiveCommerceCatalogue,
 * stripe-live-sync-service.ts) has existed since STRIPE-COMMERCIAL-4 with no
 * caller anywhere in the admin UI. This is the first and only entry point
 * into it. Deliberately not merged into StripeSyncPanel above — separate
 * component, separate state, separate confirm copy — so a coding mistake in
 * the TEST panel can never accidentally cross into live-money code, and vice
 * versa. Rendered only when the parent has confirmed (via /api/auth/session)
 * the viewer is PLATFORM_OWNER; the API routes enforce the same restriction
 * independently (requireOwner inside the service functions) — this
 * component never weakens or substitutes for that.
 */
function LiveStripeSyncPanel({
  busy,
  setBusy,
  setActionMessage,
  setActionError,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setActionMessage: (v: string | null) => void;
  setActionError: (v: string | null) => void;
}) {
  const [plan, setPlan] = useState<LiveSyncPlan | null>(null);
  const [history, setHistory] = useState<SyncRun[] | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await apiClient.get<SyncRun[]>("/api/admin/commerce/stripe/live/history"));
    } catch {
      // History is supplementary — a failed load here doesn't block the rest of the panel.
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const runLiveDryRun = useCallback(async () => {
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await apiClient.post<{ plan: LiveSyncPlan; run: SyncRun }>("/api/admin/commerce/stripe/live/dry-run", {});
      setPlan(result.plan);
      setActionMessage("Live dry run complete — review the plan below before synchronizing to LIVE Stripe.");
      await loadHistory();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [setBusy, setActionMessage, setActionError, loadHistory]);

  const runLiveSynchronize = useCallback(async () => {
    if (!plan) return;
    const productCount = plan.productsToCreate + plan.productsToUpdate;
    if (
      !window.confirm(
        `Synchronize ${plan.pricesToCreate} price(s) and ${productCount} product(s) to LIVE Stripe? This creates real, chargeable Stripe objects that customers can immediately pay with. This cannot be undone — Stripe prices are immutable once created.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await apiClient.post<{ run: SyncRun; pricesReactivated: number; errors: string[] }>("/api/admin/commerce/stripe/live/synchronize", {
        catalogueFingerprint: plan.catalogueFingerprint,
        confirm: true,
      });
      setActionMessage(result.errors.length > 0 ? `Live synchronization completed with ${result.errors.length} warning(s) — see history.` : "Live synchronization complete. These Stripe objects are now real and chargeable.");
      // Never reuse a plan/fingerprint across calls — the next synchronize
      // attempt must start from a fresh dry run, matching what the backend
      // route already enforces server-side (a stale fingerprint is rejected).
      setPlan(null);
      await loadHistory();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [plan, setBusy, setActionMessage, setActionError, loadHistory]);

  return (
    <section className="rounded-[28px] border-2 border-[#B91C1C] bg-[#FEF2F2] p-6 dark:border-[#F87171] dark:bg-[#3A1116] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#0B1630] dark:text-white">Live Stripe Synchronization</p>
        <span className="rounded-full border border-[#B91C1C] bg-[#B91C1C] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white dark:border-[#F87171] dark:bg-[#F87171] dark:text-[#3A1116]">
          Live Mode — Real Money
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-[#B91C1C] dark:text-[#F87171]">
        This panel creates real, live Stripe Products and Prices that customers can immediately pay with. Nothing here is a
        drill — synchronizing is a chargeable, irreversible action (Stripe prices are immutable once created). Only run this
        with intent.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#B91C1C]/30 pt-4 dark:border-[#F87171]/30">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runLiveDryRun()}
          className="rounded-lg border border-[#B91C1C] bg-white px-3 py-1.5 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50 dark:border-[#F87171] dark:bg-[#0B1426] dark:text-[#F87171] dark:hover:bg-[#3A1116]"
        >
          Run live dry run
        </button>
        <button
          type="button"
          disabled={busy || !plan}
          onClick={() => void runLiveSynchronize()}
          className="rounded-lg border border-[#B91C1C] bg-[#B91C1C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#F87171] dark:bg-[#F87171] dark:text-[#3A1116]"
        >
          Synchronize to LIVE Stripe
        </button>
      </div>

      {plan && (
        <div className="mt-4 rounded-2xl border border-[#B91C1C]/40 bg-white p-4 text-xs dark:border-[#F87171]/40 dark:bg-[#0B1426]">
          <p className="font-semibold text-[#0B1630] dark:text-white">Live synchronization plan</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <p>Products to create: <strong>{plan.productsToCreate}</strong></p>
            <p>Products to update: <strong>{plan.productsToUpdate}</strong></p>
            <p>Products unchanged: <strong>{plan.productsUnchanged}</strong></p>
            <p>Products to archive: <strong>{plan.productsToArchive}</strong></p>
            <p>Prices to create: <strong>{plan.pricesToCreate}</strong></p>
            <p>Prices to reactivate: <strong>{plan.pricesToReactivate}</strong></p>
            <p>Prices unchanged: <strong>{plan.pricesUnchanged}</strong></p>
            <p>Prices to archive: <strong>{plan.pricesToArchive}</strong></p>
            <p>Blocked: <strong>{plan.blockedCount}</strong></p>
          </div>
          {plan.prices.some((p) => p.action === "BLOCKED") && (
            <div className="mt-3">
              <p className="font-semibold text-[#B4841F] dark:text-[#E0B25C]">Blocked prices (never eligible for live checkout)</p>
              <ul className="mt-1 space-y-0.5 text-[#536078] dark:text-[#B8C4D8]">
                {plan.prices.filter((p) => p.action === "BLOCKED").map((p) => (
                  <li key={p.priceId}>{p.productCode} / {p.code} — {p.blockedReason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B91C1C] dark:text-[#F87171]">Live history</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-[#B91C1C]/40 dark:border-[#F87171]/40">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white text-[#536078] dark:bg-[#0B1426] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-3 py-2">Operation</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Archived</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {history.slice(0, 10).map((h) => (
                  <tr key={h.id} className="border-t border-[#B91C1C]/20 dark:border-[#F87171]/20">
                    <td className="px-3 py-2">{h.operation}{h.dryRun ? " (dry run)" : ""}</td>
                    <td className="px-3 py-2">{h.status}</td>
                    <td className="px-3 py-2">{h.productsCreated + h.pricesCreated}</td>
                    <td className="px-3 py-2">{h.productsArchived + h.pricesArchived}</td>
                    <td className="px-3 py-2">{h.blockedCount}</td>
                    <td className="px-3 py-2">{new Date(h.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
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
