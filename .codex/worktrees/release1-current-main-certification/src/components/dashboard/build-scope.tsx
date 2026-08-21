const includedItems = [
  "Responsive enterprise dashboard shell",
  "Fixed desktop sidebar with mobile navigation",
  "Top header, search placeholder, notifications, avatar",
  "Phase tracker for the current development build",
  "Realistic recent-projects demonstration table",
  "Build scope summary panel and footer",
];

const excludedItems = [
  "Authentication or user login",
  "Database or persistent storage",
  "Document extraction or AI processing",
  "Backend API integrations",
  "Payments, email, or external service workflows",
  "Client portal functionality",
];

export default function BuildScope() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Current Build Scope</p>
        <h3 className="mt-3 text-lg font-semibold text-white">Phase 1A boundaries</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-200">Included</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-400">
            {includedItems.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-200">Excluded</p>
          <ul className="mt-3 space-y-3 text-sm text-slate-400">
            {excludedItems.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-slate-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
