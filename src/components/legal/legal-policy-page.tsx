import Link from "next/link";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { PublicPageJsonLd } from "@/components/seo/public-json-ld";
import { siteConfig } from "@/config/site";
import { LtrText } from "@/lib/i18n/ltr-text";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, type TranslationKey } from "@/lib/i18n/translate";
import type { PublicSearchPath } from "@/lib/public-site/search-registry";

export type LegalPolicyId =
  | "privacy"
  | "terms"
  | "security"
  | "cookies"
  | "dataProcessing"
  | "acceptableUse"
  | "subprocessors";

type LegalSection = {
  heading: TranslationKey;
  paragraphs?: TranslationKey[];
  bullets?: TranslationKey[];
  note?: TranslationKey;
  officialLawLink?: boolean;
  contact?: boolean;
  table?: {
    headers: TranslationKey[];
    rows: TranslationKey[][];
  };
};

type LegalPolicyConfig = {
  path: PublicSearchPath;
  title: TranslationKey;
  intro: TranslationKey[];
  sections: LegalSection[];
};

const contactSection: LegalSection = {
  heading: "legal.shared.contactHeading",
  paragraphs: ["legal.shared.contactIntro"],
  contact: true,
};

const policies: Record<LegalPolicyId, LegalPolicyConfig> = {
  privacy: {
    path: "/privacy",
    title: "legal.privacy.title",
    intro: ["legal.privacy.intro", "legal.privacy.scope"],
    sections: [
      {
        heading: "legal.privacy.controllerHeading",
        paragraphs: ["legal.privacy.controllerBody", "legal.privacy.controllerPending"],
      },
      {
        heading: "legal.privacy.categoriesHeading",
        paragraphs: ["legal.privacy.categoriesIntro"],
        bullets: [
          "legal.privacy.categoryContact",
          "legal.privacy.categoryAccount",
          "legal.privacy.categoryProject",
          "legal.privacy.categoryUsage",
          "legal.privacy.categoryPayment",
          "legal.privacy.categoryIntegration",
          "legal.privacy.categoryVoice",
          "legal.privacy.categorySupport",
        ],
        note: "legal.privacy.publicFormWarning",
      },
      {
        heading: "legal.privacy.purposesHeading",
        bullets: [
          "legal.privacy.purposeService",
          "legal.privacy.purposeAccount",
          "legal.privacy.purposeProjects",
          "legal.privacy.purposePayments",
          "legal.privacy.purposeSupport",
          "legal.privacy.purposeSecurity",
          "legal.privacy.purposeImprovement",
          "legal.privacy.purposeLaw",
        ],
      },
      {
        heading: "legal.privacy.basisHeading",
        paragraphs: ["legal.privacy.basisBody", "legal.privacy.basisCaution"],
      },
      {
        heading: "legal.privacy.sharingHeading",
        paragraphs: ["legal.privacy.sharingIntro"],
        bullets: [
          "legal.privacy.sharingInfrastructure",
          "legal.privacy.sharingPayments",
          "legal.privacy.sharingDrive",
          "legal.privacy.sharingVoice",
          "legal.privacy.sharingEmail",
          "legal.privacy.sharingAdvisers",
        ],
        note: "legal.privacy.sharingPending",
      },
      {
        heading: "legal.privacy.transfersHeading",
        paragraphs: ["legal.privacy.transfersBody", "legal.privacy.transfersPending"],
      },
      {
        heading: "legal.privacy.retentionHeading",
        paragraphs: ["legal.privacy.retentionBody", "legal.privacy.retentionPending"],
        bullets: [
          "legal.privacy.retentionSession",
          "legal.privacy.retentionVerification",
          "legal.privacy.retentionReset",
          "legal.privacy.retentionOauth",
          "legal.privacy.retentionProposal",
        ],
      },
      {
        heading: "legal.privacy.rightsHeading",
        paragraphs: ["legal.privacy.rightsIntro"],
        bullets: [
          "legal.privacy.rightAccess",
          "legal.privacy.rightCorrection",
          "legal.privacy.rightDeletion",
          "legal.privacy.rightRestriction",
          "legal.privacy.rightObjection",
          "legal.privacy.rightComplaint",
        ],
        officialLawLink: true,
      },
      {
        heading: "legal.privacy.securityHeading",
        paragraphs: ["legal.privacy.securityBody", "legal.privacy.breachBody"],
      },
      {
        heading: "legal.privacy.childrenHeading",
        paragraphs: ["legal.privacy.childrenBody", "legal.privacy.changesBody"],
      },
      contactSection,
    ],
  },
  terms: {
    path: "/terms",
    title: "legal.terms.title",
    intro: ["legal.terms.intro", "legal.terms.scope"],
    sections: [
      {
        heading: "legal.terms.availabilityHeading",
        paragraphs: ["legal.terms.availabilityBody", "legal.terms.featureStatusBody"],
      },
      {
        heading: "legal.terms.accountsHeading",
        paragraphs: ["legal.terms.accountsBody", "legal.terms.credentialsBody"],
      },
      {
        heading: "legal.terms.commercialHeading",
        paragraphs: ["legal.terms.commercialBody", "legal.terms.checkoutBody", "legal.terms.commercialPending"],
      },
      {
        heading: "legal.terms.professionalHeading",
        paragraphs: ["legal.terms.professionalBody", "legal.terms.noAccuracyBody"],
        note: "legal.terms.relianceWarning",
      },
      {
        heading: "legal.terms.formatsHeading",
        paragraphs: ["legal.terms.formatsBody", "legal.terms.unavailableBody"],
      },
      {
        heading: "legal.terms.userContentHeading",
        paragraphs: ["legal.terms.userContentBody", "legal.terms.authorityBody"],
      },
      {
        heading: "legal.terms.useHeading",
        paragraphs: ["legal.terms.useBody", "legal.terms.suspensionBody"],
      },
      {
        heading: "legal.terms.lawHeading",
        paragraphs: ["legal.terms.lawPending"],
        note: "legal.shared.ownerConfirmation",
      },
      contactSection,
    ],
  },
  security: {
    path: "/security",
    title: "legal.security.title",
    intro: ["legal.security.intro", "legal.security.noGuarantee"],
    sections: [
      {
        heading: "legal.security.accessHeading",
        paragraphs: ["legal.security.accessBody", "legal.security.sessionBody"],
      },
      {
        heading: "legal.security.separationHeading",
        paragraphs: ["legal.security.separationBody", "legal.security.authorizationBody"],
      },
      {
        heading: "legal.security.filesHeading",
        paragraphs: ["legal.security.filesBody", "legal.security.deletionBody"],
      },
      {
        heading: "legal.security.integrationsHeading",
        paragraphs: ["legal.security.integrationsBody", "legal.security.voiceBody"],
      },
      {
        heading: "legal.security.paymentsHeading",
        paragraphs: ["legal.security.paymentsBody"],
      },
      {
        heading: "legal.security.monitoringHeading",
        paragraphs: ["legal.security.monitoringBody", "legal.security.incidentBody"],
      },
      {
        heading: "legal.security.boundariesHeading",
        bullets: [
          "legal.security.boundaryCertification",
          "legal.security.boundaryAvailability",
          "legal.security.boundaryOutput",
          "legal.security.boundaryProvider",
        ],
        note: "legal.shared.ownerConfirmation",
      },
      contactSection,
    ],
  },
  cookies: {
    path: "/cookie-policy",
    title: "legal.cookies.title",
    intro: ["legal.cookies.intro", "legal.cookies.scope"],
    sections: [
      {
        heading: "legal.cookies.storageHeading",
        table: {
          headers: ["legal.cookies.headerName", "legal.cookies.headerPurpose", "legal.cookies.headerDuration"],
          rows: [
            ["legal.cookies.sessionName", "legal.cookies.sessionPurpose", "legal.cookies.sessionDuration"],
            ["legal.cookies.localeName", "legal.cookies.localePurpose", "legal.cookies.localeDuration"],
            ["legal.cookies.driveName", "legal.cookies.drivePurpose", "legal.cookies.driveDuration"],
            ["legal.cookies.proposalName", "legal.cookies.proposalPurpose", "legal.cookies.proposalDuration"],
            ["legal.cookies.themeName", "legal.cookies.themePurpose", "legal.cookies.themeDuration"],
            ["legal.cookies.analyticsConsentName", "legal.cookies.analyticsConsentPurpose", "legal.cookies.analyticsConsentDuration"],
            ["legal.cookies.checkoutName", "legal.cookies.checkoutPurpose", "legal.cookies.checkoutDuration"],
          ],
        },
      },
      {
        heading: "legal.cookies.analyticsHeading",
        paragraphs: ["legal.cookies.analyticsBody", "legal.cookies.infrastructurePending"],
      },
      {
        heading: "legal.cookies.controlsHeading",
        paragraphs: ["legal.cookies.controlsBody", "legal.cookies.requiredBody"],
      },
      contactSection,
    ],
  },
  dataProcessing: {
    path: "/data-processing",
    title: "legal.dataProcessing.title",
    intro: ["legal.dataProcessing.intro", "legal.dataProcessing.contractBoundary"],
    sections: [
      {
        heading: "legal.dataProcessing.rolesHeading",
        paragraphs: ["legal.dataProcessing.rolesBody", "legal.dataProcessing.instructionsBody"],
      },
      {
        heading: "legal.dataProcessing.scopeHeading",
        paragraphs: ["legal.dataProcessing.scopeBody"],
        bullets: [
          "legal.dataProcessing.dataAccount",
          "legal.dataProcessing.dataProject",
          "legal.dataProcessing.dataContact",
          "legal.dataProcessing.dataIntegration",
          "legal.dataProcessing.dataBilling",
        ],
      },
      {
        heading: "legal.dataProcessing.subjectsHeading",
        paragraphs: ["legal.dataProcessing.subjectsBody"],
      },
      {
        heading: "legal.dataProcessing.confidentialityHeading",
        paragraphs: ["legal.dataProcessing.confidentialityBody", "legal.dataProcessing.securityBody"],
      },
      {
        heading: "legal.dataProcessing.subprocessorsHeading",
        paragraphs: ["legal.dataProcessing.subprocessorsBody", "legal.dataProcessing.transfersBody"],
      },
      {
        heading: "legal.dataProcessing.incidentsHeading",
        paragraphs: ["legal.dataProcessing.incidentsBody", "legal.dataProcessing.assistanceBody"],
      },
      {
        heading: "legal.dataProcessing.returnHeading",
        paragraphs: ["legal.dataProcessing.returnBody", "legal.dataProcessing.retentionPending"],
      },
      {
        heading: "legal.dataProcessing.informationHeading",
        paragraphs: ["legal.dataProcessing.informationBody"],
      },
      {
        heading: "legal.dataProcessing.pendingHeading",
        bullets: [
          "legal.dataProcessing.pendingEntity",
          "legal.dataProcessing.pendingProviders",
          "legal.dataProcessing.pendingTransfers",
          "legal.dataProcessing.pendingRetention",
          "legal.dataProcessing.pendingIncident",
        ],
        note: "legal.shared.ownerConfirmation",
      },
      contactSection,
    ],
  },
  acceptableUse: {
    path: "/acceptable-use",
    title: "legal.acceptableUse.title",
    intro: ["legal.acceptableUse.intro", "legal.acceptableUse.scope"],
    sections: [
      {
        heading: "legal.acceptableUse.permittedHeading",
        paragraphs: ["legal.acceptableUse.permittedBody"],
      },
      {
        heading: "legal.acceptableUse.prohibitedHeading",
        bullets: [
          "legal.acceptableUse.prohibitedAccess",
          "legal.acceptableUse.prohibitedSecurity",
          "legal.acceptableUse.prohibitedMalware",
          "legal.acceptableUse.prohibitedRights",
          "legal.acceptableUse.prohibitedPersonalData",
          "legal.acceptableUse.prohibitedIllegal",
          "legal.acceptableUse.prohibitedLoad",
          "legal.acceptableUse.prohibitedCredentials",
          "legal.acceptableUse.prohibitedOutput",
          "legal.acceptableUse.prohibitedResale",
        ],
      },
      {
        heading: "legal.acceptableUse.contentHeading",
        paragraphs: ["legal.acceptableUse.contentBody", "legal.acceptableUse.confidentialityBody"],
      },
      {
        heading: "legal.acceptableUse.outputHeading",
        paragraphs: ["legal.acceptableUse.outputBody"],
        note: "legal.acceptableUse.outputWarning",
      },
      {
        heading: "legal.acceptableUse.enforcementHeading",
        paragraphs: ["legal.acceptableUse.enforcementBody", "legal.acceptableUse.reportingBody"],
      },
      contactSection,
    ],
  },
  subprocessors: {
    path: "/subprocessors",
    title: "legal.subprocessors.title",
    intro: ["legal.subprocessors.intro", "legal.subprocessors.scope"],
    sections: [
      {
        heading: "legal.subprocessors.listHeading",
        table: {
          headers: [
            "legal.subprocessors.headerService",
            "legal.subprocessors.headerStatus",
            "legal.subprocessors.headerPurpose",
            "legal.subprocessors.headerData",
          ],
          rows: [
            ["legal.subprocessors.cloudflareService", "legal.subprocessors.pendingStatus", "legal.subprocessors.cloudflarePurpose", "legal.subprocessors.cloudflareData"],
            ["legal.subprocessors.postgresService", "legal.subprocessors.pendingStatus", "legal.subprocessors.postgresPurpose", "legal.subprocessors.postgresData"],
            ["legal.subprocessors.blobService", "legal.subprocessors.pendingStatus", "legal.subprocessors.blobPurpose", "legal.subprocessors.blobData"],
            ["legal.subprocessors.smtpService", "legal.subprocessors.pendingStatus", "legal.subprocessors.smtpPurpose", "legal.subprocessors.smtpData"],
            ["legal.subprocessors.stripeService", "legal.subprocessors.conditionalStatus", "legal.subprocessors.stripePurpose", "legal.subprocessors.stripeData"],
            ["legal.subprocessors.googleService", "legal.subprocessors.conditionalStatus", "legal.subprocessors.googlePurpose", "legal.subprocessors.googleData"],
            ["legal.subprocessors.openaiService", "legal.subprocessors.conditionalStatus", "legal.subprocessors.openaiPurpose", "legal.subprocessors.openaiData"],
          ],
        },
        note: "legal.subprocessors.pendingNote",
      },
      {
        heading: "legal.subprocessors.excludedHeading",
        paragraphs: ["legal.subprocessors.excludedBody"],
      },
      {
        heading: "legal.subprocessors.changesHeading",
        paragraphs: ["legal.subprocessors.changesBody", "legal.subprocessors.contractBody"],
      },
      contactSection,
    ],
  },
};

export default async function LegalPolicyPage({ policy }: { policy: LegalPolicyId }) {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const config = policies[policy];
  const title = t(config.title);

  return (
    <>
      <PublicPageJsonLd
        path={config.path}
        breadcrumbs={[{ name: t("legal.shared.home"), path: "/" }, { name: title, path: config.path }]}
      />
      <div className="mx-auto min-h-[70vh] max-w-3xl px-4 py-24">
        <PublicBreadcrumb
          items={[{ name: t("legal.shared.home"), item: "/" }, { name: title, item: config.path }]}
        />

        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
            {t("legal.shared.lastUpdated")}: {t("legal.shared.updatedDate")}
          </p>
          <div className="space-y-4 text-lg text-slate-700 dark:text-slate-300">
            {config.intro.map((key) => <p key={key}>{t(key)}</p>)}
          </div>
        </div>

        <div className="space-y-12">
          {config.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{t(section.heading)}</h2>

              {section.paragraphs?.length ? (
                <div className="space-y-4 text-slate-700 dark:text-slate-300">
                  {section.paragraphs.map((key) => <p key={key}>{t(key)}</p>)}
                </div>
              ) : null}

              {section.bullets?.length ? (
                <ul className="mt-4 list-disc space-y-2 ps-5 text-slate-700 dark:text-slate-300">
                  {section.bullets.map((key) => <li key={key}>{t(key)}</li>)}
                </ul>
              ) : null}

              {section.table ? (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full border-collapse text-start text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-900">
                      <tr>
                        {section.table.headers.map((key) => (
                          <th key={key} scope="col" className="border-b border-slate-200 px-4 py-3 text-start font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
                            {t(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-950">
                      {section.table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-slate-200 last:border-b-0 dark:border-slate-800">
                          {row.map((key) => (
                            <td key={key} className="max-w-xs px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                              {t(key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {section.officialLawLink ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  <Link
                    href="https://uaelegislation.gov.ae/en/legislations/1972"
                    className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                  >
                    {t("legal.privacy.officialLawLink")}
                  </Link>
                </p>
              ) : null}

              {section.note ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-100">
                  <p className="font-medium">{t(section.note)}</p>
                </div>
              ) : null}

              {section.contact ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
                  <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                    <li>
                      <strong>{t("legal.shared.email")}:</strong>{" "}
                      <a href={`mailto:${siteConfig.contact.email}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        <LtrText>{siteConfig.contact.email}</LtrText>
                      </a>
                    </li>
                    <li>
                      <strong>{t("legal.shared.telephone")}:</strong>{" "}
                      <a href={`tel:${siteConfig.contact.telephone.replace(/\s+/g, "")}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        <LtrText>{siteConfig.contact.telephone}</LtrText>
                      </a>
                    </li>
                    <li>
                      <strong>{t("legal.shared.whatsapp")}:</strong>{" "}
                      <a href={siteConfig.contact.whatsappLink} className="text-blue-600 hover:underline dark:text-blue-400">
                        <LtrText>{siteConfig.contact.whatsapp}</LtrText>
                      </a>
                    </li>
                  </ul>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
