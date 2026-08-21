const activities = [
  { time: "Just now", message: "New project workspace created for Executive Corporate Office Fit-Out." },
  { time: "1h ago", message: "BOQ draft saved for Dubai Residential Villa Structural Works." },
  { time: "3h ago", message: "Furniture BOQ revision R01 locked for review." },
  { time: "Yesterday", message: "Catalogue item F-201 updated with new supplier rate." },
];

export default function ActivityPanel() {
  return (
    <section className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Activity log</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Recent workspace activity</h2>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {activities.map((activity) => (
          <div key={activity.time} className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
            <p className="text-sm text-slate-400">{activity.time}</p>
            <p className="mt-2 text-sm text-white">{activity.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
