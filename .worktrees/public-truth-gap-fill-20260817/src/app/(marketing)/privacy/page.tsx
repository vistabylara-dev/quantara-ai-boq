import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/privacy");

export default function PrivacyPage() {
  return <LegalPolicyPage policy="privacy" />;
}
