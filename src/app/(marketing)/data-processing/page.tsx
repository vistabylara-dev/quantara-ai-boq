import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import LegalPlaceholder from "@/components/legal/LegalPlaceholder";

export const metadata = createPublicPageMetadata("/data-processing");



export default function DataProcessingPage() {
  return <LegalPlaceholder title="Data Processing Addendum" />;
}
