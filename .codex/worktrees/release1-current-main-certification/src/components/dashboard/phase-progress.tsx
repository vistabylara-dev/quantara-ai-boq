const phases = [
  { label: "Foundation", status: "success" },
  { label: "Industry Engines", status: "success" },
  { label: "Project Management", status: "success" },
  { label: "BOQ Workspace", status: "success" },
  { label: "Rate Catalogue", status: "success" },
  { label: "Verification Centre", status: "success" },
  { label: "Document Preview", status: "normal" },
  { label: "AI File Extraction", status: "planned" },
  { label: "Drawing Intelligence", status: "planned" },
  { label: "Authentication", status: "planned" },
];

const statusClasses: Record<string, string> = {
  success: "bg-emerald-500 text-white",
  normal: "bg-slate-700 text-slate-200",
  planned: "bg-slate-800 text-slate-400",
};

export default function PhaseProgress() {
  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Development phases</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Product roadmap progress</h2>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm text-slate-300">MVP stage</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {phases.map((phase) => (
          <div key={phase.label} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-slate-400">{phase.label}</p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[phase.status]}`}>
              {phase.status === "planned" ? "Planned" : phase.status === "success" ? "Complete" : "Available"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
