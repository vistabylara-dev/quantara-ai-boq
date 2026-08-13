import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export const metadata = createPublicPageMetadata("/subprocessors");

export default function SubprocessorsPage() {
  return <LegalPolicyPage policy="subprocessors" />;
}
