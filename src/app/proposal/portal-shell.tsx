import type { ReactNode } from "react";

type PortalShellProps = {
  companyName?: string;
  dir?: "ltr" | "rtl";
  children: ReactNode;
};

export function PortalShell({ companyName, dir = "ltr", children }: PortalShellProps) {
  return (
    <div dir={dir} className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">{companyName ?? "Quantara AI BOQ"}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client proposal</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        This is a secure, private link generated for you. Please do not forward it.
      </footer>
    </div>
  );
}
