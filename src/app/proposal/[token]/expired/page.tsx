import type { Metadata } from "next";
import { PortalShell } from "../../portal-shell";

export const metadata: Metadata = {
  title: "Link Unavailable | Quantara BOQ",
};

const MESSAGES: Record<string, string> = {
  EXPIRED: "This proposal link has expired. Please contact the sender for an updated link.",
  REVOKED: "This proposal link is no longer active. Please contact the sender for an updated link.",
  NOT_FOUND: "This link is not valid. Please check the link and try again.",
  INVALID_STATUS: "This proposal is not yet available. Please contact the sender.",
};

type PageProps = { searchParams: Promise<{ reason?: string }> };

export default async function ProposalExpiredPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const message = MESSAGES[params.reason ?? ""] ?? MESSAGES.NOT_FOUND;
  return (
    <PortalShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-3xl">⚠</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">This link is unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
      </div>
    </PortalShell>
  );
}
