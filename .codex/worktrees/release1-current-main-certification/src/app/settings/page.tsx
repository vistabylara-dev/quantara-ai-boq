import Link from "next/link";
import ThemeSelector from "@/components/settings/theme-selector";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Workspace settings</h1>
        <p className="mt-3 text-slate-400">Manage app defaults, locale, appearance, and persistence settings for the BOQ workspace.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Company</p>
          <p className="mt-4 text-sm text-slate-400">Company profile, branding, and document defaults used across generated documents and proposals.</p>
          <Link href="/settings/company" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Manage company settings
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Subscription</p>
          <p className="mt-4 text-sm text-slate-400">Software plan, Pro trial status, and usage limits.</p>
          <Link href="/settings/subscription" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Manage subscription
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Data packages</p>
          <p className="mt-4 text-sm text-slate-400">Industry data packages purchased separately from your software plan.</p>
          <Link href="/settings/data-packages" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Manage data packages
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Client proposals</p>
          <p className="mt-4 text-sm text-slate-400">Manage the email templates used when sending client proposals.</p>
          <Link href="/settings/email-templates" className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Manage email templates
          </Link>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Locale settings</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-semibold text-white">Currency</p>
              <p className="mt-1 text-sm text-slate-400">Set your default BOQ currency.</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <p className="font-semibold text-white">Language</p>
              <p className="mt-1 text-sm text-slate-400">Set your default project language.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ThemeSelector />

          <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Persistence</p>
            <p className="mt-4 text-sm text-slate-400">Project and BOQ data are stored locally in the browser for this build.</p>
            <button className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Reset demo data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
