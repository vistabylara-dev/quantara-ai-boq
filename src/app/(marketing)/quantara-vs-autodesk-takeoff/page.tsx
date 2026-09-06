import { CompetitorComparisonPage } from "@/components/layout/competitor-comparison-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export function generateMetadata() {
  return createPublicPageMetadata("/quantara-vs-autodesk-takeoff");
}

export default function Page() {
  return <CompetitorComparisonPage competitor="autodesk-takeoff" />;
}
