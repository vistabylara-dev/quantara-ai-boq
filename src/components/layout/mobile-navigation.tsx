import Link from "next/link";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Industries", href: "/industries" },
  { label: "Catalogue", href: "/catalogue" },
  { label: "Templates", href: "/templates" },
  { label: "Settings", href: "/settings" },
];

export default function MobileNavigation() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm text-slate-300">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 transition hover:border-slate-700 hover:bg-slate-800"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
