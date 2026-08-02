import type { PhaseItem } from "../../types/dashboard";

export default function PhaseTracker({ items }: { items: PhaseItem[] }) {
  return (
    <div className="mt-6 space-y-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                item.status === "active"
                  ? "bg-blue-600 text-blue-100"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {item.status === "active" ? "Active" : "Locked"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
