"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

type CheckoutAvailability = {
  hasExistingSubscription: boolean;
  products: Array<{
    productCode: string;
    prices: Array<{
      priceCode: string;
      billingInterval: "MONTH" | "YEAR";
      amountMinor: number;
      currency: string;
      available: boolean;
      unavailableReason: string | null;
    }>;
  }>;
};

type ManagedMarketplaceProduct = {
  code: string;
  type: string;
  name: string;
  shortDescription: string;
  description: string;
  purchaseMode: string;
  category: string;
  slug: string;
  prices: Array<{
    code: string;
    amountMinor: number;
    currency: string;
    billingInterval: "ONE_TIME" | "MONTH" | "YEAR";
    isFromPrice: boolean;
    reviewStatus: string;
  }>;
};

export default function ManagedProductsSection() {
  const [products, setProducts] = useState<ManagedMarketplaceProduct[]>([]);
  const [checkout, setCheckout] = useState<CheckoutAvailability | null>(null);
  const [busyPriceCode, setBusyPriceCode] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void apiClient
      .get<ManagedMarketplaceProduct[]>(
        "/api/marketplace/managed-products",
        controller.signal,
      )
      .then(setProducts)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProducts([]);
      });

    void apiClient
      .get<CheckoutAvailability>(
        "/api/commerce/checkout-options",
        controller.signal,
      )
      .then(setCheckout)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Marketplace listings remain visible even when the authenticated
        // checkout-readiness endpoint is unavailable.
        setCheckout(null);
      });

    return () => controller.abort();
  }, []);

  async function startCheckout(
    priceCode: string,
    billingInterval: "MONTH" | "YEAR",
  ) {
    if (busyPriceCode) return;

    setBusyPriceCode(priceCode);
    setCheckoutError(null);

    try {
      const result = await apiClient.post<{
        checkoutSessionId: string;
        checkoutUrl: string;
      }>("/api/commerce/checkout", {
        checkoutMode: "SUBSCRIPTION",
        priceCode,
        billingInterval,
      });

      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout could not be started.",
      );
      setBusyPriceCode(null);
    }
  }

  if (products.length === 0) return null;

  return (
    <section className="rounded-[32px] border border-violet-900/60 bg-slate-950 p-6 sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-400">
          Quantara Products
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Published products & professional offers
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Products published from Quantara&apos;s owner Product Manager.
          Marketplace publication does not by itself enable Stripe checkout.
        </p>
      </div>

      {checkoutError && (
        <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-300">
          {checkoutError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const price = product.prices[0];
          const checkoutProduct = checkout?.products.find(
            (candidate) => candidate.productCode === product.code,
          );
          const checkoutPrice = checkoutProduct?.prices.find(
            (candidate) => candidate.priceCode === price?.code,
          );
          const suffix =
            price?.billingInterval === "MONTH"
              ? "/mo"
              : price?.billingInterval === "YEAR"
                ? "/yr"
                : "";

          return (
            <article
              key={product.code}
              className="flex flex-col rounded-[28px] border border-violet-900/50 bg-violet-950/10 p-5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
                {product.category}
              </p>

              <h3 className="mt-2 text-lg font-bold text-white">
                {product.name}
              </h3>

              <p className="mt-2 flex-grow text-sm text-slate-400">
                {product.shortDescription}
              </p>

              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="text-xl font-semibold text-white">
                  {price
                    ? `${price.currency} ${(price.amountMinor / 100).toLocaleString("en-AE")}${suffix}`
                    : "Contact sales"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {checkoutPrice?.available
                    ? "Secure checkout available"
                    : product.purchaseMode === "DIRECT"
                      ? "Checkout pending commercial & fulfilment readiness"
                      : product.purchaseMode === "QUOTATION_REQUIRED"
                        ? "Quotation required"
                        : "Contact sales"}
                </p>
              </div>

              <div className="mt-5 grid gap-2">
                <Link
                  href={`/products/${product.slug}`}
                  className="rounded-xl border border-violet-600 px-4 py-3 text-center text-sm font-bold text-violet-200 transition-colors hover:bg-violet-950/40"
                >
                  View product
                </Link>

                {checkoutPrice?.available && (
                  <button
                    type="button"
                    disabled={busyPriceCode === checkoutPrice.priceCode}
                    onClick={() =>
                      void startCheckout(
                        checkoutPrice.priceCode,
                        checkoutPrice.billingInterval,
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busyPriceCode === checkoutPrice.priceCode
                      ? "Opening checkout…"
                      : "Buy now"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
