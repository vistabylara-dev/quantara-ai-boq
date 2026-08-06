import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProposalView } from "@/lib/services/public-proposal-service";
import { PortalShell } from "../portal-shell";
import ProposalClientView from "./proposal-client-view";
import TechnicalReportClientView from "./technical-report-client-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Proposal | Quantara BOQ",
};

type PageProps = { params: Promise<{ token: string }> };

export default async function ProposalPortalPage({ params }: PageProps) {
  const { token } = await params;
  const request = new Request("http://internal.local/", { headers: await headers() });
  const result = await getPublicProposalView(token, request);

  if (!result.ok) {
    redirect(`/proposal/${token}/expired?reason=${result.reason}`);
  }
  if (result.passcodeRequired) {
    redirect(`/proposal/${token}/access`);
  }

  const { view, proposal } = result;
  if (proposal.status === "APPROVED") redirect(`/proposal/${token}/approved`);
  if (proposal.status === "REVISION_REQUESTED") redirect(`/proposal/${token}/revision-requested`);

  return (
    <PortalShell companyName={view.company.tradeName || view.company.legalName} dir={view.settings.clientLanguage === "Arabic" ? "rtl" : "ltr"}>
      {view.sourceType === "TECHNICAL_REPORT_REVISION" ? (
        <TechnicalReportClientView token={token} initialView={view} initialProposal={proposal} />
      ) : (
        <ProposalClientView token={token} initialView={view} initialProposal={proposal} />
      )}
    </PortalShell>
  );
}
