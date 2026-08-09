import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";

export const metadata = createPublicPageMetadata("/contact-sales");

export default function ContactSalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicPageJsonLd
        path="/contact-sales"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Contact Sales", path: "/contact-sales" }]}
      />
      {children}
    </>
  );
}
