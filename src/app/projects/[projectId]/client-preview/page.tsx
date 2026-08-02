import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Preview | Quantara AI BOQ",
};

export default function ProjectClientPreviewPage() {
  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client preview</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">Client ready summary</h2>
      <p className="mt-3 max-w-2xl text-slate-400">Preview the top-level project scope and totals in a clean client-facing layout.</p>

      <div className="mt-8 space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Preview mode</p>
        <p className="text-base text-white">Quantara AI BOQ client report is currently in placeholder mode for this development phase.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Project scope</p>
            <p className="mt-2 text-lg font-semibold text-white">Summary + BOQ</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client view</p>
            <p className="mt-2 text-lg font-semibold text-white">Simplified deliverables</p>
          </div>
        </div>
      </div>
    </div>
  );
}
