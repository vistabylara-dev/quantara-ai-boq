export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Templates</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">BOQ & document templates</h1>
        <p className="mt-3 text-slate-400">Define reusable BOQ sections, report templates, and document structures for proposals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "BOQ template", description: "Structured BOQ templates for repeatable tender workflows." },
          { title: "Proposal cover", description: "Project proposal templates for client communication." },
          { title: "Report summary", description: "Executive summary templates for stakeholder review." },
        ].map((template) => (
          <div key={template.title} className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{template.title}</p>
            <p className="mt-3 text-sm text-slate-400">{template.description}</p>
            <button className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              View template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
