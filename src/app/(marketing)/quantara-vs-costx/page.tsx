import { CompetitorComparisonPage } from "@/components/layout/competitor-comparison-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export function generateMetadata() {
  return createPublicPageMetadata("/quantara-vs-costx");
}

export default function Page() {
  return <CompetitorComparisonPage competitor="costx" />;
}
