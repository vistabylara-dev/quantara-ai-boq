import Link from "next/link";
import type { IndustryEngine } from "@/types/industry";

export default function IndustryEngineCard({ industry }: { industry: IndustryEngine }) {
  return (
    <article className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{industry.shortName}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{industry.name}</h2>
        </div>
        <span className="inline-flex rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
          {industry.status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{industry.description}</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">{industry.supportedUnits.length}</p>
          <p className="mt-1 text-slate-400">Supported units</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">{industry.boqSections.length}</p>
          <p className="mt-1 text-slate-400">BOQ sections</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {industry.boqSections.slice(0, 3).map((section) => (
          <span key={section.id} className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            {section.code}
          </span>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/industry-engines/${industry.id}`}
          className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          View details
        </Link>
        <Link
          href="/projects/new"
          className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Start project
        </Link>
      </div>
    </article>
  );
}
