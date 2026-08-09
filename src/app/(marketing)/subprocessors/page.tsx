import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import LegalPlaceholder from "@/components/legal/LegalPlaceholder";

export const metadata = createPublicPageMetadata("/subprocessors");



export default function SubprocessorsPage() {
  return <LegalPlaceholder title="Subprocessor List" />;
}
