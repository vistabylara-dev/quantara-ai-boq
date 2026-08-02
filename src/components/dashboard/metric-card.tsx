import type { MetricCard as MetricCardType } from "../../types/dashboard";

const badgeClasses = {
  normal: "bg-slate-900 text-slate-300 border-slate-800",
  success: "bg-emerald-950 text-emerald-300 border-emerald-700",
  warning: "bg-amber-950 text-amber-300 border-amber-700",
  danger: "bg-rose-950 text-rose-300 border-rose-700",
};

export default function MetricCard({ card }: { card: MetricCardType }) {
  return (
    <article className="rounded-[28px] border border-slate-800 bg-slate-950 p-5 shadow-sm shadow-slate-950/20">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClasses[card.state]}`}>
          {card.state === "normal" ? "Stable" : card.state === "success" ? "Good" : card.state === "warning" ? "Watch" : "Alert"}
        </span>
      </div>
      <p className="mt-6 text-3xl font-semibold text-white">{card.value}</p>
      <p className="mt-3 text-sm text-slate-400">{card.trend}</p>
    </article>
  );
}
