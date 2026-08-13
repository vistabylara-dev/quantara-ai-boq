import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/cookie-policy");

export default function CookiePolicyPage() {
  return <LegalPolicyPage policy="cookies" />;
}
