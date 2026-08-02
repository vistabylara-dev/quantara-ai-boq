import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

type ProjectLayoutProps = {
  children: ReactNode;
  params: { projectId: string };
};

export function generateMetadata({ params }: ProjectLayoutProps): Metadata {
  return {
    title: `Project ${params.projectId} | Quantara AI BOQ`,
  };
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const basePath = `/projects/${params.projectId}`;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Project workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{params.projectId.replace(/-/g, " ")}</h1>
            <p className="mt-2 text-sm text-slate-400">Review the project BOQ, verification checks, documents, and client preview.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={basePath}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Overview
            </Link>
            <Link
              href={`${basePath}/boq`}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              BOQ Studio
            </Link>
            <Link
              href={`${basePath}/verification`}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Verification
            </Link>
            <Link
              href={`${basePath}/documents`}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Documents
            </Link>
            <Link
              href={`${basePath}/client-preview`}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Client Preview
            </Link>
            <Link
              href={`${basePath}/proposals`}
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Proposals
            </Link>
          </div>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
