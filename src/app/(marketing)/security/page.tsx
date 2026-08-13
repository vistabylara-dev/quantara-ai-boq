import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/security");

export default function SecurityPage() {
  return <LegalPolicyPage policy="security" />;
}
