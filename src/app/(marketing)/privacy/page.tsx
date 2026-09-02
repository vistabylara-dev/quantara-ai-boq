import { getServerLocale } from "@/lib/i18n/server-locale";
import LegalPolicyPage from "@/components/legal/legal-policy-page";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/privacy", locale);
}

export default function PrivacyPage() {
  return <LegalPolicyPage policy="privacy" />;
}
