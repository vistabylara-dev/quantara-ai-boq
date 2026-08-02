import type { IndustryEngine } from "@/types/industry";
import { ArrowUpRight, Columns, ShieldCheck } from "lucide-react";

export default function IndustrySummaryCard({ industry }: { industry: IndustryEngine }) {
  return (
    <article className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{industry.shortName}</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{industry.name}</h3>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300">
          <ArrowUpRight className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-400">{industry.description}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Columns className="h-4 w-4 text-slate-400" />
            <span>Sections</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{industry.boqSections.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <span>Rules</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{industry.validationRules.length}</p>
        </div>
      </div>
    </article>
  );
}
