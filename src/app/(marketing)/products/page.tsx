import Link from "next/link";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { listPublishedManagedProducts } from "@/lib/services/managed-product-public-service";

export const dynamic = "force-dynamic";

export const metadata = createPublicPageMetadata("/products");

function priceLabel(product: Awaited<ReturnType<typeof listPublishedManagedProducts>>[number]) {
  const price = product.prices[0];
  if (!price) return "Contact sales";

  const suffix =
    price.billingInterval === "MONTH"
      ? "/month"
      : price.billingInterval === "YEAR"
        ? "/year"
        : "";

  return `${price.currency} ${(price.amountMinor / 100).toLocaleString("en-AE")}${suffix}`;
}

export default async function ProductsPage() {
  const products = await listPublishedManagedProducts();

  return (
    <>
      <PublicPageJsonLd
        path="/products"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
        ]}
      />
      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">
        Quantara Marketplace
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
        Products & professional digital tools
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        Explore Quantara products and offers published by the platform owner.
        Product availability and purchase route are shown on each product page.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.code} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {product.category}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              {product.name}
            </h2>
            <p className="mt-3 flex-grow text-sm leading-6 text-slate-600">
              {product.shortDescription}
            </p>
            <p className="mt-5 text-lg font-semibold text-slate-950">
              {priceLabel(product)}
            </p>
            <Link
              href={`/products/${product.slug}`}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              View product
            </Link>
          </article>
        ))}
      </div>

      {products.length === 0 && (
        <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-slate-600">
          No Product Manager offers are published yet.
        </div>
      )}
      </main>
    </>
  );
}
