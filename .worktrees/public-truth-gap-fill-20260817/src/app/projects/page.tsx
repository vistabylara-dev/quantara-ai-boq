"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/types/project";
import { formatDate } from "@/lib/formatting/dates";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";

type PlatformRole =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "PLATFORM_SUPPORT";

type SessionData = {
  authenticated: boolean;
  user?: {
    platformRole: PlatformRole | null;
  };
};

export default function ProjectsPage() {
  const t = useTranslations();

  const [
    tayqanAssignmentMode,
    setTayqanAssignmentMode,
  ] = useState(false);

  const [
    platformRole,
    setPlatformRole,
  ] = useState<PlatformRole | null>(
    null,
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      setProjects(await apiClient.get<Project[]>("/api/projects", signal));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [loadProjects]);

  useEffect(() => {
    const mode =
      new URLSearchParams(
        window.location.search,
      ).get("tayqan");

    const assigning =
      mode === "assign"
      || mode === "admin";

    setTayqanAssignmentMode(
      assigning,
    );

    const controller =
      new AbortController();

    void apiClient
      .get<SessionData>(
        "/api/auth/session",
        controller.signal,
      )
      .then((session) => {
        setPlatformRole(
          session.user?.platformRole
          ?? null,
        );
      })
      .catch((sessionError) => {
        if (
          sessionError instanceof DOMException
          && sessionError.name === "AbortError"
        ) {
          return;
        }
        setPlatformRole(null);
      });

    return () =>
      controller.abort();
  }, []);

  const [removingProjectId, setRemovingProjectId] =
    useState<string | null>(null);

  const removeProjectFromWorkspace = useCallback(
    async (project: Project) => {
      if (
        !window.confirm(
          `Remove "${project.name}" from the active workspace? This archives the project; it does not hard-delete project evidence.`,
        )
      ) {
        return;
      }

      setRemovingProjectId(project.id);
      setError(null);

      try {
        await apiClient.delete(
          `/api/projects/${encodeURIComponent(project.id)}`,
        );
        await loadProjects();
      } catch (removeError) {
        setError(getApiErrorMessage(removeError));
      } finally {
        setRemovingProjectId(null);
      }
    },
    [loadProjects],
  );

  const internalAdminAccess =
    platformRole === "PLATFORM_OWNER"
    || platformRole === "PLATFORM_ADMIN";

  const ownerAccess =
    platformRole === "PLATFORM_OWNER";

  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              {tayqanAssignmentMode
                ? t("tayqan.projectPickerEyebrow")
                : "Projects"}
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              {tayqanAssignmentMode
                ? t("tayqan.projectPickerTitle")
                : "Project workspace list"}
            </h1>

            {tayqanAssignmentMode && (
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                {t(
                  internalAdminAccess
                    ? "tayqan.projectPickerAdminDescription"
                    : "tayqan.projectPickerCustomerDescription",
                )}
              </p>
            )}
          </div>
          <Link
            href="/projects/new"
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            New project
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">Loading projects</p>
            <p className="mt-2 text-sm text-slate-400">Fetching company project workspaces...</p>
          </div>
        ) : error ? (
          <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
            <p className="text-lg font-semibold text-white">Projects unavailable</p>
            <p className="mt-2 text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadProjects()}
              className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[32px] border border-slate-800 bg-slate-950">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Industry</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Updated</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-800 hover:bg-slate-900">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{project.name}</p>
                      <p className="text-xs text-slate-500">{project.reference}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{project.industryId.replace(/-/g, " ")}</td>
                    <td className="px-6 py-4 text-slate-300">{project.status}</td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(project.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          Open
                        </Link>

                        {ownerAccess && !tayqanAssignmentMode && (
                          <button
                            type="button"
                            onClick={() =>
                              void removeProjectFromWorkspace(project)
                            }
                            disabled={removingProjectId === project.id}
                            className="inline-flex rounded-2xl border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {removingProjectId === project.id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        )}

                        {tayqanAssignmentMode && (
                          <Link
                            href={`/projects/${project.id}/tayqan`}
                            className="inline-flex rounded-2xl border border-cyan-500 bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                          >
                            {t(
                              "tayqan.assignProjectCta",
                            )}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      No projects yet. Use New project to create the first workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
