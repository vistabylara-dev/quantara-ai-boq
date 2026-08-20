import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublishedManagedProductBySlug,
} from "@/lib/services/managed-product-public-service";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-site/search-registry";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedManagedProductBySlug(slug);

  if (!product) {
    return {
      title: "Product not found | Quantara",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${PUBLIC_SITE_ORIGIN}/products/${product.slug}`;

  return {
    title: product.seo.metaTitle || product.name,
    description: product.seo.metaDescription || product.shortDescription,
    alternates: { canonical },
    openGraph: {
      title: product.seo.metaTitle || product.name,
      description: product.seo.metaDescription || product.shortDescription,
      url: canonical,
      type: "website",
      ...(product.merchant.imageUrl ? { images: [{ url: product.merchant.imageUrl }] } : {}),
    },
  };
}

function priceText(product: NonNullable<Awaited<ReturnType<typeof getPublishedManagedProductBySlug>>>) {
  const price = product.prices[0];
  if (!price) return "Contact sales";

  const suffix =
    price.billingInterval === "MONTH"
      ? " / month"
      : price.billingInterval === "YEAR"
        ? " / year"
        : "";

  return `${price.currency} ${(price.amountMinor / 100).toLocaleString("en-AE")}${suffix}`;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getPublishedManagedProductBySlug(slug);
  if (!product) notFound();

  const price = product.prices[0];
  const canonical = `${PUBLIC_SITE_ORIGIN}/products/${product.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": product.type === "SUBSCRIPTION" ? "SoftwareApplication" : "Product",
    name: product.name,
    description: product.description,
    url: canonical,
    ...(product.merchant.imageUrl ? { image: product.merchant.imageUrl } : {}),
    ...(product.merchant.brand ? { brand: { "@type": "Brand", name: product.merchant.brand } } : {}),
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: price.currency,
            price: (price.amountMinor / 100).toFixed(2),
            availability:
              product.merchant.availability === "out_of_stock"
                ? "https://schema.org/OutOfStock"
                : product.merchant.availability === "preorder"
                  ? "https://schema.org/PreOrder"
                  : "https://schema.org/InStock",
            url: canonical,
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <nav className="text-sm text-slate-500">
        <Link href="/products" className="hover:text-slate-950">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-600">
            {product.category}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {product.shortDescription}
          </p>

          <div className="mt-8 whitespace-pre-line text-base leading-8 text-slate-700">
            {product.description}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Published offer
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {priceText(product)}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {product.purchaseMode === "DIRECT"
              ? "Direct checkout is enabled only after Quantara verifies the product's commercial and fulfilment readiness."
              : product.purchaseMode === "QUOTATION_REQUIRED"
                ? "This product requires a quotation before purchase."
                : "Contact the Quantara team to discuss this product."}
          </p>

          <Link
            href="/marketplace"
            className="mt-6 block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Quantara Marketplace
          </Link>
        </aside>
      </div>
    </main>
  );
}
