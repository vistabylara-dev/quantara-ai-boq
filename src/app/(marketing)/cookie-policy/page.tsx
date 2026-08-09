import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import LegalPlaceholder from "@/components/legal/LegalPlaceholder";

export const metadata = createPublicPageMetadata("/cookie-policy");



export default function CookiePolicyPage() {
  return <LegalPlaceholder title="Cookie Policy" />;
}
