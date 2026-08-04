import Link from "next/link";
import { demoProjects } from "@/data/demo-projects";
import { demoIndustries } from "@/config/industries";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-10">
          <span className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-xs uppercase tracking-[0.32em] text-slate-400">
            Quantity intelligence
          </span>
          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">Quantara AI BOQ</h1>
            <p className="max-w-2xl text-slate-400">
              A production-minded foundation for project-based BOQ management, industry engines, and local persistence.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Projects</p>
              <p className="mt-3 text-3xl font-semibold text-white">{demoProjects.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Industry engines</p>
              <p className="mt-3 text-3xl font-semibold text-white">{demoIndustries.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Local persistence</p>
              <p className="mt-3 text-3xl font-semibold text-white">Ready</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Open dashboard
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Manage projects
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold text-white">Getting started</h2>
            <ul className="mt-4 space-y-3 text-slate-400">
              <li className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="font-semibold text-white">Create a new project</p>
                <p className="mt-1 text-sm">Choose an industry engine and begin structuring your BOQ.</p>
              </li>
              <li className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="font-semibold text-white">Review industry engines</p>
                <p className="mt-1 text-sm">Inspect engine section sets and validation guidance for each trade.</p>
              </li>
              <li className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="font-semibold text-white">View the catalogue</p>
                <p className="mt-1 text-sm">Reference standard catalogue items for recurring BOQ work packages.</p>
              </li>
            </ul>
          </div>

          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold text-white">Workspace highlights</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Recent engine</p>
                <p className="mt-2 text-base font-semibold text-white">{demoIndustries[0]?.name}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Active sample</p>
                <p className="mt-2 text-base font-semibold text-white">{demoProjects[0]?.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
