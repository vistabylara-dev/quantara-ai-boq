"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/types/project";
import { formatDate } from "@/lib/formatting/dates";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type IndustrySummary = {
  id?: string;
  key?: string;
  name: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [industryCount, setIndustryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, industries] = await Promise.all([
        apiClient.get<Project[]>("/api/projects", signal),
        apiClient.get<IndustrySummary[]>("/api/industries", signal),
      ]);
      setProjects(projectData);
      setIndustryCount(industries.length);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading project intelligence</p>
        <p className="mt-2 text-sm text-slate-400">Fetching projects and industry engine coverage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Dashboard unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{error}</p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    );
  }

  const recentProjects = projects.slice(0, 4);

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Workspace dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Project intelligence summary</h1>
            <p className="mt-3 text-slate-400">Track active projects, recent activity, and industry engine coverage.</p>
          </div>
          <Link
            href="/projects"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Manage projects
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Projects</p>
            <p className="mt-3 text-4xl font-semibold text-white">{projects.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Industry engines</p>
            <p className="mt-3 text-4xl font-semibold text-white">{industryCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Data source</p>
            <p className="mt-3 text-4xl font-semibold text-white">Backend</p>
          </div>
        </div>
      </div>

      <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Recent projects</h2>
            <p className="mt-1 text-sm text-slate-400">Open a workspace or continue a sample review.</p>
          </div>
          <Link
            href="/projects"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            All projects
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Industry</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Updated</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((project) => (
                <tr key={project.id} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{project.name}</p>
                    <p className="text-xs text-slate-500">{project.reference}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{project.industryId.replace(/-/g, " ")}</td>
                  <td className="px-6 py-4 text-slate-300">{project.status}</td>
                  <td className="px-6 py-4 text-slate-300">{formatDate(project.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {recentProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No projects yet. Create a project to begin building a BOQ workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
