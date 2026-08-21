import type { ProjectRow } from "../../types/dashboard";

export default function RecentProjects({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-300">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-6 py-4">Project</th>
              <th className="px-6 py-4">Stage</th>
              <th className="px-6 py-4">Confidence</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.projectId} className="border-t border-slate-800 bg-slate-950 hover:bg-slate-900">
                <td className="px-6 py-4">
                  <p className="font-semibold text-white">{project.name}</p>
                  <p className="text-xs text-slate-500">{project.projectId}</p>
                </td>
                <td className="px-6 py-4 text-slate-300">{project.stage}</td>
                <td className="px-6 py-4 text-slate-300">{project.confidence}</td>
                <td className="px-6 py-4 text-slate-300">{project.status}</td>
                <td className="px-6 py-4 text-slate-300">{project.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
