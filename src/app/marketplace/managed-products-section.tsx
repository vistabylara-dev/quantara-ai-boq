"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

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
        // Strictly additive: this channel must never break Industry Library
        // or TAYQAN if its own API is temporarily unavailable.
        setProducts([]);
      });

    return () => controller.abort();
  }, []);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const price = product.prices[0];
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
                  {product.purchaseMode === "DIRECT"
                    ? "Checkout pending commercial & fulfilment readiness"
                    : product.purchaseMode === "QUOTATION_REQUIRED"
                      ? "Quotation required"
                      : "Contact sales"}
                </p>
              </div>

              <Link
                href={`/products/${product.slug}`}
                className="mt-5 rounded-xl border border-violet-600 bg-violet-600 px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-violet-500"
              >
                View product
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
