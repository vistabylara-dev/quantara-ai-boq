import { demoIndustries } from "@/config/industries";
import type { Metadata } from "next";
import Link from "next/link";

type PageProps = {
  params: { industryId: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  const industry = demoIndustries.find((item) => item.id === params.industryId);
  return {
    title: industry ? `${industry.name} Engine | Quantara AI BOQ` : "Industry Engine | Quantara AI BOQ",
  };
}

export default function IndustryDetailPage({ params }: PageProps) {
  const industry = demoIndustries.find((item) => item.id === params.industryId);
  if (!industry) {
    return (
      <div className="min-h-screen bg-[#07111F] text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xl font-semibold text-white">Industry engine not found</p>
          <p className="mt-3 text-slate-400">Please return to the industry engines list.</p>
          <Link href="/industries" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Back to engines
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{industry.shortName}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{industry.name} Engine</h1>
            <p className="mt-3 max-w-2xl text-slate-400">{industry.description}</p>
          </div>
          <Link href="/projects/new" className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Create project with engine
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold text-white">Supported sections</h2>
            <div className="mt-4 grid gap-3">
              {industry.boqSections.map((section) => (
                <div key={section.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                  <p className="font-semibold text-white">{section.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{section.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-lg font-semibold text-white">Supported units</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {industry.supportedUnits.map((unit) => (
                  <span key={unit} className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-lg font-semibold text-white">Validation rules</h3>
              <ul className="mt-4 space-y-2 text-slate-400">
                {industry.validationRules.map((rule) => (
                  <li key={rule} className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
