import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/acceptable-use");

export default function AcceptableUsePage() {
  return <LegalPolicyPage policy="acceptableUse" />;
}
