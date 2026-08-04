import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicTechnicalReportView } from "@/lib/services/public-technical-report-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technical Report | Quantara AI BOQ",
};

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "This link is not valid. Please check the link and try again.",
  REVOKED: "This report link is no longer active. Please contact the sender for an updated link.",
  EXPIRED: "This report link has expired. Please contact the sender for an updated link.",
  NOT_READY: "This report is still being prepared. Please try again shortly, or contact the sender.",
};

type PageProps = { params: Promise<{ token: string }> };

function Shell({ companyName, children }: { companyName?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">{companyName ?? "Quantara AI BOQ"}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Technical report</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        This is a secure, private link generated for you. Please do not forward it.
      </footer>
    </div>
  );
}

export default async function PublicTechnicalReportPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getPublicTechnicalReportView(token);

  if (!result.ok) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-3xl">⚠</p>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">This link is unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{MESSAGES[result.reason]}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell companyName={result.companyName}>
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{result.projectName}</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{result.reportName}</h1>
        {result.completedAt ? (
          <p className="mt-2 text-sm text-slate-500">Issued {new Date(result.completedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })}</p>
        ) : null}
        <a
          href={`/api/public/technical-reports/${token}/download`}
          className="mt-6 inline-block rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Download Technical Report
        </a>
      </div>
    </Shell>
  );
}
