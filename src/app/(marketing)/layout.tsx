import PublicFooter from "@/components/layout/public-footer";
import PublicHeader from "@/components/layout/public-header";
import LeadCapturePopup from "@/components/marketing/lead-capture-popup";
import PublicJsonLd from "@/components/seo/public-json-ld";
import AnalyticsConsentBanner from "@/components/legal/analytics-consent-banner";
import { buildPublicEntityGraph } from "@/lib/public-site/schema";
import SalesAssistant from "@/components/marketing/sales-assistant";

const publicEntityGraph = buildPublicEntityGraph();

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-theme="dark" className="min-h-screen bg-[#030508] text-white">
      <PublicJsonLd id="quantara-public-entities" data={publicEntityGraph} />
      <PublicHeader />
      <main id="main-content" className="flex-1 bg-[#030508]">{children}</main>
      {process.env.SALES_AGENT_ENABLED === "true" && <SalesAssistant />}
      <PublicFooter />
      <LeadCapturePopup mode="public" />
      <AnalyticsConsentBanner />
    </div>
  );
}
