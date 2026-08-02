import { demoIndustries } from "@/config/industries";
import IndustryEngineCard from "@/components/industries/industry-engine-card";
import Link from "next/link";

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Industry Engines</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Configurable industry engines</h1>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Create new project
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {demoIndustries.map((industry) => (
            <IndustryEngineCard key={industry.id} industry={industry} />
          ))}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm font-semibold text-white">Custom Engine</p>
            <p className="mt-3 text-sm text-slate-400">Coming later. Custom engine creation will be available in a future phase.</p>
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
              <p className="font-medium text-slate-200">Planned capabilities</p>
              <ul className="mt-3 space-y-2 text-slate-400">
                <li>Custom sections</li>
                <li>Specialized field maps</li>
                <li>Industry-specific validations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
