import { CompetitorComparisonPage } from "@/components/layout/competitor-comparison-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export function generateMetadata() {
  return createPublicPageMetadata("/quantara-vs-kreo");
}

export default function Page() {
  return <CompetitorComparisonPage competitor="kreo" />;
}
