import Link from "next/link";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Industries", href: "/industries" },
  { label: "Catalogue", href: "/catalogue" },
  { label: "Templates", href: "/templates" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="hidden xl:flex xl:w-72 xl:flex-col xl:gap-6 xl:border-r xl:border-slate-800 xl:px-6 xl:py-8 bg-slate-950 text-slate-100">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Workspace</p>
        <h2 className="text-2xl font-semibold text-white">Quantara AI</h2>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navigation.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:border-slate-700 hover:bg-slate-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        <p className="text-slate-200">Compact enterprise navigation.</p>
        <p className="mt-3 text-xs leading-5 text-slate-500">Use the mobile menu to reach these sections on smaller screens.</p>
      </div>
    </aside>
  );
}
