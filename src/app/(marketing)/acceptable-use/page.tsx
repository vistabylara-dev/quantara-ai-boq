import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import LegalPlaceholder from "@/components/legal/LegalPlaceholder";

export const metadata = createPublicPageMetadata("/acceptable-use");



export default function AcceptableUsePage() {
  return <LegalPlaceholder title="Acceptable Use Policy" />;
}
