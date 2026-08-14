import { FileUp, Link2, Download, Copy, PencilLine, Clock } from "lucide-react";
import { GuideTip } from "@/components/guidance/guide-tip";
import { useTranslations } from "@/lib/i18n/locale-provider";

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
  const t = useTranslations();
  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">{t("boqCreate.wizard.createYourBoq")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{t("boqCreate.chooseHow")}</h2>
        <p className="mt-3 text-slate-400">{t("boqCreate.wizard.subtitle")}</p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hasDrafts && (
          <StartCard
            icon={<Clock className="h-6 w-6" />}
            iconTone="bg-blue-950 text-blue-400 group-hover:bg-blue-900 group-hover:text-blue-300"
            title={t("boqCreate.wizard.continueExistingDraft")}
            description={t("boqCreate.wizard.continueExistingDraftDescription")}
            onClick={() => onSelectMethod("continue_draft")}
          />
        )}

        <StartCard
          icon={<FileUp className="h-6 w-6" />}
          iconTone="bg-indigo-950 text-indigo-400 group-hover:bg-indigo-900 group-hover:text-indigo-300"
          title={t("boqCreate.useDocument")}
          description={t("boqCreate.wizard.useDocumentDescription")}
          onClick={() => onSelectMethod("upload_drawings")}
          help={{
            title: t("boqCreate.wizard.useDocumentHelpTitle"),
            shortDescription: t("boqCreate.wizard.useDocumentHelpShort"),
            whatQuantaraDoes: t("boqCreate.wizard.useDocumentHelpQuantara"),
            whatProfessionalCanDo: t("boqCreate.wizard.useDocumentHelpProfessional"),
          }}
        />

        <StartCard
          icon={<Link2 className="h-6 w-6" />}
          iconTone="bg-emerald-950 text-emerald-400 group-hover:bg-emerald-900 group-hover:text-emerald-300"
          title={t("boqCreate.wizard.connectAppTitle")}
          description={t("boqCreate.wizard.connectAppDescription")}
          onClick={() => onSelectMethod("connect_app")}
          help={{
            title: t("boqCreate.wizard.connectAppHelpTitle"),
            shortDescription: t("boqCreate.wizard.connectAppHelpShort"),
            whatQuantaraDoes: t("boqCreate.wizard.connectAppHelpQuantara"),
            whatProfessionalCanDo: t("boqCreate.wizard.connectAppHelpProfessional"),
          }}
        />

        <StartCard
          icon={<Download className="h-6 w-6" />}
          iconTone="bg-amber-950 text-amber-400"
          title={t("boqCreate.wizard.importMeasurements")}
          description={t("boqCreate.wizard.importMeasurementsDescription")}
          unavailable={{
            reason: t("boqCreate.wizard.importMeasurementsUnavailable"),
            todayAlternatives: [
              { label: t("boqCreate.wizard.useDocumentInstead"), onClick: () => onSelectMethod("upload_drawings") },
              { label: t("boqCreate.startManually"), onClick: () => onSelectMethod("start_manually") },
            ],
          }}
        />

        <StartCard
          icon={<Copy className="h-6 w-6" />}
          iconTone="bg-purple-950 text-purple-400"
          title={t("boqCreate.wizard.importBoq")}
          description={t("boqCreate.wizard.importBoqDescription")}
          unavailable={{
            reason: t("boqCreate.wizard.importBoqUnavailable"),
            todayAlternatives: [
              { label: t("boqCreate.wizard.useDocumentInstead"), onClick: () => onSelectMethod("upload_drawings") },
              { label: t("boqCreate.startManually"), onClick: () => onSelectMethod("start_manually") },
            ],
          }}
        />

        <StartCard
          icon={<PencilLine className="h-6 w-6" />}
          iconTone="bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white"
          title={t("boqCreate.startManually")}
          description={t("boqCreate.wizard.startManuallyDescription")}
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
  const t = useTranslations();

  if (unavailable) {
    return (
      <div className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/30 p-6 text-start">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}>{icon}</div>
          <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
            {t("boqCreate.wizard.notAvailableYet")}
          </span>
        </div>
        <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        <p className="mt-3 text-xs text-amber-300">{unavailable.reason}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("boqCreate.wizard.todayYouCan")}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {unavailable.todayAlternatives.map((alt) => (
            <button
              key={alt.label}
              type="button"
              onClick={alt.onClick}
              className="text-start text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
            >
              {alt.label} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">{"→"}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-start transition hover:border-blue-500/50 hover:bg-slate-900">
      {help && (
        <div className="absolute end-4 top-4">
          <GuideTip
            title={help.title}
            shortDescription={help.shortDescription}
            whatQuantaraDoes={help.whatQuantaraDoes}
            whatProfessionalCanDo={help.whatProfessionalCanDo}
            cta={onClick ? { label: title, onAction: onClick } : undefined}
            ariaLabel={`Help: ${help.title}`}
          />
        </div>
      )}
      <button type="button" onClick={onClick} className="flex flex-1 flex-col text-start">
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
