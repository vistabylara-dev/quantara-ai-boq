import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/data-processing");

export default function DataProcessingPage() {
  return <LegalPolicyPage policy="dataProcessing" />;
}
