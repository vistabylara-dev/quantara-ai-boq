import { FileUp, Link2, Download, Copy, PencilLine, Clock } from "lucide-react";

export type BoqCreationMethod =
  | "upload_drawings"
  | "connect_app"
  | "import_measurements"
  | "import_boq"
  | "start_manually"
  | "continue_draft";

interface BoqCreationMethodSelectorProps {
  onSelectMethod: (method: BoqCreationMethod) => void;
  hasDrafts?: boolean;
}

/**
 * Guided BOQ measurement workflow (Release 1), spec section 13 — every card
 * here must be honest about whether it does something real. "Upload
 * Drawings" and "Connect an Engineering Application" route to real,
 * already-working pages (the project's file/drawings workflow and the
 * integrations hub). "Import Measurements" and "Import Existing BOQ" have
 * no real implementation yet — they are visibly disabled and labeled
 * "Coming Soon" instead of accepting a click that used to fall through to a
 * generic alert.
 */
export function BoqCreationMethodSelector({ onSelectMethod, hasDrafts }: BoqCreationMethodSelectorProps) {
  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-semibold text-white">How would you like to create this BOQ?</h2>
        <p className="mt-3 text-slate-400">
          Choose a method to extract quantities and start building your Bill of Quantities.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hasDrafts && (
          <button
            type="button"
            onClick={() => onSelectMethod("continue_draft")}
            className="group flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition hover:border-blue-500/50 hover:bg-slate-900"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950 text-blue-400 transition group-hover:scale-110 group-hover:bg-blue-900 group-hover:text-blue-300">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-lg font-semibold text-white">Continue Existing Draft</h3>
            <p className="mt-2 text-sm text-slate-400">
              Resume working on an existing unlocked BOQ draft for this project.
            </p>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectMethod("upload_drawings")}
          className="group flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition hover:border-blue-500/50 hover:bg-slate-900"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950 text-indigo-400 transition group-hover:scale-110 group-hover:bg-indigo-900 group-hover:text-indigo-300">
            <FileUp className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">Upload Drawings or Floor Plans</h3>
          <p className="mt-2 text-sm text-slate-400">
            Upload PDFs, IFC, or CAD files. We will process sheets and generate measurement candidates automatically.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectMethod("connect_app")}
          className="group flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition hover:border-emerald-500/50 hover:bg-slate-900"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 transition group-hover:scale-110 group-hover:bg-emerald-900 group-hover:text-emerald-300">
            <Link2 className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">Connect an Engineering Application</h3>
          <p className="mt-2 text-sm text-slate-400">
            Link directly to Archicad, Revit, or Autodesk Construction Cloud to stream intelligent models.
          </p>
        </button>

        <button
          type="button"
          disabled
          title="Coming soon"
          aria-disabled="true"
          className="group flex cursor-not-allowed flex-col rounded-3xl border border-slate-800 bg-slate-900/30 p-6 text-left opacity-60"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950 text-amber-400">
              <Download className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
              Coming soon
            </span>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">Import Measurements</h3>
          <p className="mt-2 text-sm text-slate-400">
            Import bulk quantity takeoffs from Excel or CSV to match with catalogue items.
          </p>
        </button>

        <button
          type="button"
          disabled
          title="Coming soon"
          aria-disabled="true"
          className="group flex cursor-not-allowed flex-col rounded-3xl border border-slate-800 bg-slate-900/30 p-6 text-left opacity-60"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-950 text-purple-400">
              <Copy className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
              Coming soon
            </span>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">Import Existing BOQ</h3>
          <p className="mt-2 text-sm text-slate-400">
            Upload a structured BOQ spreadsheet and instantly map it into the Quantara format.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectMethod("start_manually")}
          className="group flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition hover:border-slate-500/50 hover:bg-slate-900"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-300 transition group-hover:scale-110 group-hover:bg-slate-700 group-hover:text-white">
            <PencilLine className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">Start Manually</h3>
          <p className="mt-2 text-sm text-slate-400">
            Create an empty BOQ and add items manually by searching the predictive catalogue.
          </p>
        </button>
      </div>
    </div>
  );
}
