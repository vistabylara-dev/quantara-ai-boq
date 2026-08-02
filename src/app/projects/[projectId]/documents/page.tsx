import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Project Documents | Quantara AI BOQ",
};

export default function ProjectDocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Documents</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Project document package</h2>
        <p className="mt-3 text-slate-400">Export BOQ packages, cover letters, and client-ready documentation from this workspace.</p>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { title: "BOQ summary", description: "Generate an export-ready summary with cost breakdowns." },
            { title: "Client cover letter", description: "Build a polished project letter for approval sign-off." },
            { title: "Scope package", description: "Prepare a scoped document package for the client review." },
          ].map((doc) => (
            <div key={doc.title} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{doc.title}</p>
              <p className="mt-3 text-sm text-slate-400">{doc.description}</p>
              <button className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                Build document
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
