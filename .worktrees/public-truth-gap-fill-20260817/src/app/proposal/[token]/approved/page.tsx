import type { Metadata } from "next";
import { PortalShell } from "../../portal-shell";

export const metadata: Metadata = {
  title: "Proposal Approved | Quantara BOQ",
};

export default function ProposalApprovedPage() {
  return (
    <PortalShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center">
        <p className="text-3xl">✓</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Thank you — this proposal has been approved</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your approval has been recorded. Our team has been notified and will be in touch with next steps.
        </p>
      </div>
    </PortalShell>
  );
}
