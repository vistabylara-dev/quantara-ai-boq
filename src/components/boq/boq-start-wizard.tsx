import { FileUp, Link2, Download, Copy, PencilLine, Clock } from "lucide-react";
import { GuideTip } from "@/components/guidance/guide-tip";

export type BoqCreationMethod =
  | "upload_drawings"
  | "connect_app"
  | "import_measurements"
  | "import_boq"
  | "start_manually"
  | "continue_draft";

interface BoqStartWizardProps {
  onSelectMethod: (method: BoqCreationMethod) => void;
  hasDrafts?: boolean;
}

/**
 * The professional's entry point into creating a BOQ. Every card here must
 * be honest about what actually happens today — no claimed automation that
 * doesn't exist, no dead-end "Coming soon" cards with nothing else to do.
 * Each primary path gets a lightbulb explaining what this does, what
 * Quantara does, what the user needs to do, and what happens next — the
 * visible label + button remain the primary instruction; the lightbulb is
 * additional depth, never the only explanation.
 */
export function BoqStartWizard({ onSelectMethod, hasDrafts }: BoqStartWizardProps) {
  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">Create your BOQ</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Choose how you want Quantara to begin</h2>
        <p className="mt-3 text-slate-400">
          Every path ends in the same place — a professionally reviewed Bill of Quantities. Nothing you choose here
          locks you in; you can add more sources or items later.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hasDrafts && (
          <StartCard
            icon={<Clock className="h-6 w-6" />}
            iconTone="bg-blue-950 text-blue-400 group-hover:bg-blue-900 group-hover:text-blue-300"
            title="Continue Existing Draft"
            description="Resume working on an existing unlocked BOQ draft for this project."
            onClick={() => onSelectMethod("continue_draft")}
          />
        )}

        <StartCard
          icon={<FileUp className="h-6 w-6" />}
          iconTone="bg-indigo-950 text-indigo-400 group-hover:bg-indigo-900 group-hover:text-indigo-300"
          title="Use a Document"
          description="Upload or select a project source and let Quantara extract supported information for your professional review."
          onClick={() => onSelectMethod("upload_drawings")}
          help={{
            title: "What files can I use?",
            shortDescription: "Quantara reliably extracts structured data from text-based PDFs, CSV, and XLSX files.",
            whatQuantaraDoes:
              "Structured extraction works on PDF pages with a real text/table layer, plus CSV and XLSX files. "
              + "Image-only or scanned PDFs, and native DWG/RVT/IFC files, are stored for reference but are not "
              + "automatically extracted today.",
            whatProfessionalCanDo:
              "Upload the file, let Quantara process it, and review every candidate it finds before anything is "
              + "added to your BOQ.",
          }}
        />

        <StartCard
          icon={<Link2 className="h-6 w-6" />}
          iconTone="bg-emerald-950 text-emerald-400 group-hover:bg-emerald-900 group-hover:text-emerald-300"
          title="Connect an Application"
          description="Bring authorized project information into Quantara from a connected source like Google Drive."
          onClick={() => onSelectMethod("connect_app")}
          help={{
            title: "How integrations work",
            shortDescription: "You connect your account, choose the exact project or file, and nothing becomes an approved BOQ item without your review.",
            whatQuantaraDoes:
              "You connect your account once. You then choose the specific project/file to bring in — Quantara "
              + "imports only what you select, never your whole account.",
            whatProfessionalCanDo:
              "Pick which connected application to use next. Availability varies by provider — some are ready "
              + "today, others need setup first.",
          }}
        />

        <StartCard
          icon={<Download className="h-6 w-6" />}
          iconTone="bg-amber-950 text-amber-400"
          title="Import Measurements"
          description="Import bulk quantity takeoffs from Excel or CSV to match with catalogue items."
          unavailable={{
            reason: "Bulk measurement import is not available yet.",
            todayAlternatives: [
              { label: "Use a document instead", onClick: () => onSelectMethod("upload_drawings") },
              { label: "Start manually", onClick: () => onSelectMethod("start_manually") },
            ],
          }}
        />

        <StartCard
          icon={<Copy className="h-6 w-6" />}
          iconTone="bg-purple-950 text-purple-400"
          title="Import Existing BOQ"
          description="Upload a structured BOQ spreadsheet and map it into the Quantara format."
          unavailable={{
            reason: "Importing an existing BOQ spreadsheet is not available yet.",
            todayAlternatives: [
              { label: "Use a document instead", onClick: () => onSelectMethod("upload_drawings") },
              { label: "Start manually", onClick: () => onSelectMethod("start_manually") },
            ],
          }}
        />

        <StartCard
          icon={<PencilLine className="h-6 w-6" />}
          iconTone="bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white"
          title="Start Manually"
          description="Create an editable BOQ and add items yourself using catalogue search, manual entry, or voice."
          onClick={() => onSelectMethod("start_manually")}
        />
      </div>
    </div>
  );
}

type StartCardHelp = {
  title: string;
  shortDescription: string;
  whatQuantaraDoes: string;
  whatProfessionalCanDo: string;
};

type StartCardUnavailable = {
  reason: string;
  todayAlternatives: Array<{ label: string; onClick: () => void }>;
};

function StartCard({
  icon,
  iconTone,
  title,
  description,
  onClick,
  help,
  unavailable,
}: {
  icon: React.ReactNode;
  iconTone: string;
  title: string;
  description: string;
  onClick?: () => void;
  help?: StartCardHelp;
  unavailable?: StartCardUnavailable;
}) {
  if (unavailable) {
    return (
      <div className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/30 p-6 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}>{icon}</div>
          <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
            Not available yet
          </span>
        </div>
        <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        <p className="mt-3 text-xs text-amber-300">{unavailable.reason}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Today you can:</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {unavailable.todayAlternatives.map((alt) => (
            <button
              key={alt.label}
              type="button"
              onClick={alt.onClick}
              className="text-left text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
            >
              {alt.label} →
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition hover:border-blue-500/50 hover:bg-slate-900">
      {help && (
        <div className="absolute right-4 top-4">
          <GuideTip
            title={help.title}
            shortDescription={help.shortDescription}
            whatQuantaraDoes={help.whatQuantaraDoes}
            whatProfessionalCanDo={help.whatProfessionalCanDo}
            ariaLabel={`Help: ${help.title}`}
          />
        </div>
      )}
      <button type="button" onClick={onClick} className="flex flex-1 flex-col text-left">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-110 ${iconTone}`}>
          {icon}
        </div>
        <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </button>
    </div>
  );
}

export default BoqStartWizard;
