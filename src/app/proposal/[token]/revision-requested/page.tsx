import type { Metadata } from "next";
import { PortalShell } from "../../portal-shell";

export const metadata: Metadata = {
  title: "Revision Requested | Quantara BOQ",
};

export default function ProposalRevisionRequestedPage() {
  return (
    <PortalShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-orange-200 bg-white p-8 text-center">
        <p className="text-3xl">✎</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Revision request received</h1>
        <p className="mt-2 text-sm text-slate-500">
          Thank you for your feedback. Our team will review your comments and follow up with an updated proposal.
        </p>
      </div>
    </PortalShell>
  );
}
