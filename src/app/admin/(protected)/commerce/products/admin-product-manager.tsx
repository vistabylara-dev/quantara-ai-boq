"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  PackagePlus,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type BillingInterval = "ONE_TIME" | "MONTH" | "YEAR";
type PurchaseMode = "DIRECT" | "QUOTATION_REQUIRED" | "CONTACT_SALES";

type ManagedProduct = {
  id: string;
  code: string;
  name: string;
  purchaseMode: PurchaseMode;
  isActive: boolean;
  isPublic: boolean;
  publicationState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  marketplaceEnabled: boolean;
  category: string;
  slug: string;
  merchant: { enabled: boolean };
  fulfillmentAdapter: "NONE";
  prices: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    billingInterval: BillingInterval;
    isActive: boolean;
    reviewStatus: string;
  }>;
};

type FormState = {
  name: string;
  code: string;
  category: string;
  shortDescription: string;
  description: string;
  priceAed: string;
  billingInterval: BillingInterval;
  purchaseMode: PurchaseMode;
  marketplaceEnabled: boolean;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  merchantEnabled: boolean;
  merchantTitle: string;
  merchantDescription: string;
  googleProductCategory: string;
  googleProductType: string;
  brand: string;
  mpn: string;
  gtin: string;
  imageUrl: string;
  availability: "in_stock" | "out_of_stock" | "preorder";
  condition: "new" | "refurbished" | "used";
};

const initialForm: FormState = {
  name: "",
  code: "",
  category: "Digital product",
  shortDescription: "",
  description: "",
  priceAed: "",
  billingInterval: "ONE_TIME",
  purchaseMode: "DIRECT",
  marketplaceEnabled: true,
  slug: "",
  metaTitle: "",
  metaDescription: "",
  merchantEnabled: false,
  merchantTitle: "",
  merchantDescription: "",
  googleProductCategory: "",
  googleProductType: "",
  brand: "Quantara",
  mpn: "",
  gtin: "",
  imageUrl: "",
  availability: "in_stock",
  condition: "new",
};

const panel =
  "rounded-[28px] border border-[#D9E2EC] bg-white p-6 sm:p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]";
const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2.5 text-sm text-[#0B1630] outline-none focus:border-[#0EA5E9] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white";
const labelClass = "text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]";

function normalizeCode(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatPrice(product: ManagedProduct) {
  const price = product.prices.find((candidate) => candidate.isActive);
  if (!price) return "No active price";

  const suffix =
    price.billingInterval === "MONTH"
      ? "/mo"
      : price.billingInterval === "YEAR"
        ? "/yr"
        : "";

  return `${price.currency} ${(price.amountMinor / 100).toLocaleString("en-AE")}${suffix}`;
}

export default function AdminProductManager() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      setProducts(
        await apiClient.get<ManagedProduct[]>(
          "/api/admin/commerce/product-manager",
          signal,
        ),
      );
    } catch (loadFailure) {
      if (loadFailure instanceof DOMException && loadFailure.name === "AbortError") return;
      setLoadError(getApiErrorMessage(loadFailure));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      code: current.code || normalizeCode(value),
      slug: current.slug || normalizeSlug(value),
      metaTitle: current.metaTitle || value.slice(0, 70),
      merchantTitle: current.merchantTitle || value.slice(0, 150),
    }));
  }

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.name.trim() &&
          form.code.trim() &&
          form.category.trim() &&
          form.shortDescription.trim() &&
          form.description.trim() &&
          Number(form.priceAed) > 0 &&
          form.slug.trim() &&
          form.metaTitle.trim() &&
          form.metaDescription.trim() &&
          (!form.merchantEnabled ||
            (form.merchantTitle.trim() && form.merchantDescription.trim())),
      ),
    [form],
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      [product.name, product.code, product.category, product.slug].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [products, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSaving) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const created = await apiClient.post<ManagedProduct>(
        "/api/admin/commerce/product-manager",
        { ...form, priceAed: Number(form.priceAed) },
      );
      setMessage(`${created.name} saved as an inert private draft. Stripe and Marketplace were not changed.`);
      setForm(initialForm);
      await load();
    } catch (saveFailure) {
      setError(getApiErrorMessage(saveFailure));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className={panel}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">
              Quantara Commerce · Owner
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/30 bg-[#0EA5E9]/10">
                <Store className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" />
              </span>
              <div>
                <h1 className="text-3xl font-semibold text-[#0B1630] dark:text-white">Product Manager</h1>
                <p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">
                  Product catalogue, SEO, sales channels and commercial readiness.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <StatusBadge icon={ShieldCheck} label="Schema" value="Protected" />
            <StatusBadge icon={CircleDollarSign} label="Stripe" value="Untouched" />
            <StatusBadge icon={Store} label="Marketplace" value="Draft-gated" />
            <StatusBadge icon={Globe2} label="Merchant" value="Policy-gated" />
          </div>
        </div>
      </header>

      {(message || error) && (
        <div className={`rounded-2xl border p-4 text-sm ${
          error
            ? "border-rose-400/40 bg-rose-400/5 text-rose-600 dark:text-rose-300"
            : "border-emerald-400/40 bg-emerald-400/5 text-emerald-700 dark:text-emerald-300"
        }`}>
          {error ?? message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={submit} className={`${panel} space-y-7`}>
          <Section icon={PackagePlus} title="Product" description="Commercial identity and customer-facing offer.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Product title">
                <input value={form.name} onChange={(e) => updateName(e.target.value)} className={inputClass} />
              </Field>
              <Field title="Product code / SKU">
                <input value={form.code} onChange={(e) => update("code", normalizeCode(e.target.value))} className={inputClass} />
              </Field>
              <Field title="Category">
                <input value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass} />
              </Field>
              <Field title="Price (AED)">
                <input type="number" min="0.01" step="0.01" value={form.priceAed} onChange={(e) => update("priceAed", e.target.value)} className={inputClass} />
              </Field>
              <Field title="Billing">
                <select value={form.billingInterval} onChange={(e) => update("billingInterval", e.target.value as BillingInterval)} className={inputClass}>
                  <option value="ONE_TIME">One-time</option>
                  <option value="MONTH">Monthly</option>
                  <option value="YEAR">Yearly</option>
                </select>
              </Field>
              <Field title="Purchase route">
                <select value={form.purchaseMode} onChange={(e) => update("purchaseMode", e.target.value as PurchaseMode)} className={inputClass}>
                  <option value="DIRECT">Direct checkout</option>
                  <option value="QUOTATION_REQUIRED">Quotation required</option>
                  <option value="CONTACT_SALES">Contact sales</option>
                </select>
              </Field>
            </div>

            <Field title="Short description">
              <textarea value={form.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} className={`${inputClass} min-h-20`} maxLength={300} />
            </Field>

            <Field title="Full description">
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={`${inputClass} min-h-36`} maxLength={5000} />
            </Field>

            <ToggleRow
              checked={form.marketplaceEnabled}
              onChange={(v) => update("marketplaceEnabled", v)}
              title="Marketplace sales channel"
              description="Prepare this product for Marketplace after the guarded publish stage."
            />
          </Section>

          <Section icon={Search} title="Search & AI discovery" description="SEO metadata stored with the product.">
            <Field title="URL slug">
              <input value={form.slug} onChange={(e) => update("slug", normalizeSlug(e.target.value))} className={inputClass} />
            </Field>
            <Field title="Meta title">
              <input value={form.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} className={inputClass} maxLength={70} />
            </Field>
            <Field title="Meta description">
              <textarea value={form.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} className={`${inputClass} min-h-24`} maxLength={320} />
            </Field>
          </Section>

          <Section icon={Globe2} title="Google Merchant" description="Optional data; submission remains policy-gated.">
            <ToggleRow
              checked={form.merchantEnabled}
              onChange={(v) => update("merchantEnabled", v)}
              title="Enable Merchant data"
              description="Use only when the product satisfies Merchant requirements."
            />

            {form.merchantEnabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field title="Merchant title"><input value={form.merchantTitle} onChange={(e) => update("merchantTitle", e.target.value)} className={inputClass} /></Field>
                  <Field title="Brand"><input value={form.brand} onChange={(e) => update("brand", e.target.value)} className={inputClass} /></Field>
                  <Field title="Google Product Category"><input value={form.googleProductCategory} onChange={(e) => update("googleProductCategory", e.target.value)} className={inputClass} /></Field>
                  <Field title="Product type"><input value={form.googleProductType} onChange={(e) => update("googleProductType", e.target.value)} className={inputClass} /></Field>
                  <Field title="MPN"><input value={form.mpn} onChange={(e) => update("mpn", e.target.value)} className={inputClass} /></Field>
                  <Field title="GTIN"><input value={form.gtin} onChange={(e) => update("gtin", e.target.value.replace(/\D/g, ""))} className={inputClass} /></Field>
                  <Field title="Image URL"><input value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} className={inputClass} /></Field>
                  <Field title="Availability">
                    <select value={form.availability} onChange={(e) => update("availability", e.target.value as FormState["availability"])} className={inputClass}>
                      <option value="in_stock">In stock</option>
                      <option value="out_of_stock">Out of stock</option>
                      <option value="preorder">Preorder</option>
                    </select>
                  </Field>
                  <Field title="Condition">
                    <select value={form.condition} onChange={(e) => update("condition", e.target.value as FormState["condition"])} className={inputClass}>
                      <option value="new">New</option>
                      <option value="refurbished">Refurbished</option>
                      <option value="used">Used</option>
                    </select>
                  </Field>
                </div>

                <Field title="Merchant description">
                  <textarea value={form.merchantDescription} onChange={(e) => update("merchantDescription", e.target.value)} className={`${inputClass} min-h-28`} maxLength={5000} />
                </Field>
              </>
            )}
          </Section>

          <div className="flex flex-col gap-3 border-t border-[#D9E2EC] pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-[#1E2A42]">
            <p className="max-w-2xl text-xs text-[#536078] dark:text-[#B8C4D8]">
              Save Draft is fail-closed: inactive, private and price-review gated. Publish will be a separate guarded stage using the proven Stripe sync.
            </p>
            <button type="submit" disabled={!canSubmit || isSaving} className="shrink-0 rounded-xl bg-[#0EA5E9] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#22D3EE] dark:text-[#050B18]">
              {isSaving ? "Saving…" : "Save product draft"}
            </button>
          </div>
        </form>

        <aside className={`${panel} h-fit`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">Managed products</h2>
            <span className="rounded-full bg-[#EEF3F8] px-3 py-1 text-xs dark:bg-[#111D33]">{products.length}</span>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#7B879C]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} mt-0 pl-9`} placeholder="Search products" />
          </div>

          {loadError && <p className="mt-4 text-sm text-rose-500">{loadError}</p>}

          {isLoading ? (
            <p className="mt-4 text-sm text-[#7B879C]">Loading Product Manager…</p>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleProducts.map((product) => {
                const activePrice = product.prices.find((p) => p.isActive);
                return (
                  <article key={product.id} className="rounded-2xl border border-[#D9E2EC] p-4 dark:border-[#1E2A42]">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0B1630] dark:text-white">{product.name}</p>
                        <p className="text-xs text-[#7B879C]">{product.code}</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                        {product.publicationState}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-semibold">{formatPrice(product)}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#536078] dark:text-[#B8C4D8]">
                      <MiniReadiness ready={product.marketplaceEnabled} label="Marketplace" />
                      <MiniReadiness ready={product.merchant.enabled} label="Merchant data" />
                      <MiniReadiness ready={activePrice?.reviewStatus === "APPROVED"} label="Price approved" />
                      <MiniReadiness ready={product.isPublic && product.isActive} label="Published" />
                    </div>

                    <div className="mt-3 rounded-xl bg-[#EEF3F8] p-3 text-xs dark:bg-[#111D33]">
                      Fulfilment adapter: <strong>{product.fulfillmentAdapter}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Store;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-[#D9E2EC] pt-6 first:border-t-0 first:pt-0 dark:border-[#1E2A42]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF3F8] dark:bg-[#111D33]">
          <Icon className="h-4 w-4 text-[#0284C7] dark:text-[#22D3EE]" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[#0B1630] dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-[#7B879C]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{title}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D9E2EC] p-4 dark:border-[#1E2A42]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="block text-sm font-semibold text-[#0B1630] dark:text-white">{title}</span>
        <span className="mt-1 block text-xs text-[#536078] dark:text-[#B8C4D8]">{description}</span>
      </span>
    </label>
  );
}

function StatusBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#D9E2EC] bg-[#F7FAFC] px-3 py-2 dark:border-[#1E2A42] dark:bg-[#111D33]">
      <div className="flex items-center gap-1.5 text-[#536078]">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1 font-semibold text-[#0B1630] dark:text-white">{value}</p>
    </div>
  );
}

function MiniReadiness({
  ready,
  label,
}: {
  ready: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle2 className={`h-3.5 w-3.5 ${ready ? "text-emerald-600" : "text-[#A0AEC0]"}`} />
      <span>{label}</span>
    </div>
  );
}