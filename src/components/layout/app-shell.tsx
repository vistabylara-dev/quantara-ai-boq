import Link from "next/link";
import Sidebar from "./sidebar";
import TopHeader from "./top-header";
import MobileNavigation from "./mobile-navigation";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Clients", href: "/clients" },
  { label: "Industries", href: "/industries" },
  { label: "Catalogue", href: "/catalogue" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Templates", href: "/templates" },
  { label: "Settings", href: "/settings" },
];

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#07111F] text-white">
      <div className="xl:flex">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopHeader />
          <div className="border-b border-slate-800 bg-[#0F1C2E] px-4 py-4 xl:hidden">
            <MobileNavigation />
          </div>
          <main className="flex-1 px-4 pb-8 pt-6 sm:px-6 xl:px-10">
            <div className="mb-4 hidden items-center justify-between gap-4 xl:flex">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Application navigation</p>
                <div className="flex flex-wrap gap-2">
                  {navigation.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
      <footer className="border-t border-slate-800 bg-[#0F1C2E] px-4 py-4 text-sm text-slate-500 xl:px-10">
        Quantara AI • Development Build 0.1.0
      </footer>
    </div>
  );
}
