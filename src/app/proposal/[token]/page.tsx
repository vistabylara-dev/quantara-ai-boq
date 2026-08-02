import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicProposalView } from "@/lib/services/public-proposal-service";
import { PortalShell } from "../portal-shell";
import ProposalClientView from "./proposal-client-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Proposal | Quantara AI BOQ",
};

type PageProps = { params: { token: string } };

export default async function ProposalPortalPage({ params }: PageProps) {
  const request = new Request("http://internal.local/", { headers: headers() });
  const result = await getPublicProposalView(params.token, request);

  if (!result.ok) {
    redirect(`/proposal/${params.token}/expired?reason=${result.reason}`);
  }
  if (result.passcodeRequired) {
    redirect(`/proposal/${params.token}/access`);
  }

  const { view, proposal } = result;
  if (proposal.status === "APPROVED") redirect(`/proposal/${params.token}/approved`);
  if (proposal.status === "REVISION_REQUESTED") redirect(`/proposal/${params.token}/revision-requested`);

  return (
    <PortalShell companyName={view.company.tradeName || view.company.legalName} dir={view.settings.clientLanguage === "Arabic" ? "rtl" : "ltr"}>
      <ProposalClientView token={params.token} initialView={view} initialProposal={proposal} />
    </PortalShell>
  );
}
