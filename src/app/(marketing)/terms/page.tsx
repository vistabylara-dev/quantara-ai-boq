import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/terms");

export default function TermsPage() {
  return <LegalPolicyPage policy="terms" />;
}
