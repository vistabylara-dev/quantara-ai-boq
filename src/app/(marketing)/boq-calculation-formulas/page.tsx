import {
  createPublicPageMetadata,
  getPublicSearchPage,
} from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import PublicJsonLd from "@/components/seo/public-json-ld";
import { Calculator, ArrowRight, BookOpen } from "lucide-react";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator, translateStructuredContent } from "@/lib/i18n/translate";

export const metadata = createPublicPageMetadata("/boq-calculation-formulas");

const formulaFaqs = [
  {
    question: "Is there one formula for calculating a BOQ?",
    answer: "No. A BOQ combines different measurement methods. Each construction element is measured using an appropriate length, area, volume, weight or count formula, then multiplied by its reviewed unit rate.",
  },
  {
    question: "What is the basic BOQ cost formula?",
    answer: "The basic item formula is Quantity × Unit Rate. The BOQ total is the sum of all item amounts.",
  },
  {
    question: "Does a BOQ calculator replace a quantity surveyor?",
    answer: "No. A calculator can assist with arithmetic and planning, but drawings, dimensions, measurement rules, rates, specifications, assumptions and contractual requirements must be reviewed by qualified professionals.",
  },
  {
    question: "Can I use the Vista By Lara calculator for UAE projects?",
    answer: "The external calculator can support preliminary quantity and cost planning. Users must replace illustrative values with project-specific dimensions and approved rates and complete professional review.",
  },
  {
    question: "Does the calculator send results into Quantara?",
    answer: "No automatic transfer is represented. The Vista By Lara BOQ Calculator is a separate educational planning tool.",
  },
] as const;

const searchEntry = getPublicSearchPage("/boq-calculation-formulas");
const pageSchema = buildPublicPageGraph({
  path: "/boq-calculation-formulas",
  title: searchEntry.title,
  description: searchEntry.description,
  breadcrumbs: [
    { name: "Home", path: "/" },
    { name: "Resources", path: "/resources" },
    { name: "BOQ Calculation Formulas", path: "/boq-calculation-formulas" },
  ],
  faqs: formulaFaqs,
  kind: "tech-article",
});

type ArabicFormulaContent = {
  breadcrumbs: string[];
  badge: string;
  title: string;
  introduction: string;
  measurementRulesTitle: string;
  measurementRules: string;
  referencePrefix: string;
  referenceLabel: string;
  referenceSuffix: string;
  masterTitle: string;
  itemAmountTitle: string;
  itemAmountFormula: string;
  itemAmountVariables: string[];
  totalCostTitle: string;
  totalCostFormula: string;
  totalCostDescription: string;
  unitRateTitle: string;
  unitRateFormula: string;
  unitRateVariables: string[];
  unitRateNote: string;
  quantityTitle: string;
  measurementSections: Array<{ title: string; formulas: string[]; details?: string[]; example?: string; note?: string }>;
  costTitle: string;
  costCards: Array<{ title: string; formula: string; details: string[] }>;
  workedTitle: string;
  tableHeaders: string[];
  tableRows: string[][];
  totalLabel: string;
  totalValue: string;
  ratesNote: string;
  workflowTitle: string;
  workflowSteps: string[];
  calculatorTitle: string;
  calculatorBody: string;
  calculatorAction: string;
  calculatorCaption: string;
  faqTitle: string;
  faqs: Array<{ question: string; answer: string }>;
};

function ArabicFormulaPage({ content }: { content: ArabicFormulaContent }) {
  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="flex min-h-screen flex-col bg-[#030508] text-slate-100">
        <PublicBreadcrumb items={[
          { name: content.breadcrumbs[0], item: "/" },
          { name: content.breadcrumbs[1], item: "/resources" },
          { name: content.breadcrumbs[2], item: "/boq-calculation-formulas" },
        ]} />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 md:py-20 lg:px-8 lg:py-24">
          <header className="mb-12">
            <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300">
              <BookOpen className="me-2 h-4 w-4" />
              {content.badge}
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">{content.title}</h1>
            <p className="my-8 border-s-4 border-blue-500 ps-6 text-xl leading-relaxed text-slate-600 dark:text-slate-300">{content.introduction}</p>
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-slate-500 dark:text-slate-400"><strong>{content.measurementRulesTitle}</strong> {content.measurementRules}</p>
              <p className="mt-3 text-slate-500 dark:text-slate-400">
                {content.referencePrefix}{" "}
                <a href="https://www.rics.org/content/dam/ricsglobal/documents/standards/nrm_2_detailed_measurement_for_building_works_1st_edition_rics.pdf" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline dark:text-blue-300">{content.referenceLabel}</a>{" "}
                {content.referenceSuffix}
              </p>
            </div>
          </header>

          <article className="space-y-14">
            <section>
              <h2 className="mb-6 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.masterTitle}</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-4 text-xl font-bold">{content.itemAmountTitle}</h3>
                  <div dir="ltr" className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-center font-mono text-lg font-semibold dark:border-slate-800 dark:bg-slate-950">{content.itemAmountFormula}</div>
                  <ul className="space-y-2 text-sm">{content.itemAmountVariables.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-4 text-xl font-bold">{content.totalCostTitle}</h3>
                  <div dir="ltr" className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-center font-mono text-lg font-semibold dark:border-slate-800 dark:bg-slate-950">{content.totalCostFormula}</div>
                  <p className="text-sm">{content.totalCostDescription}</p>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 text-xl font-bold">{content.unitRateTitle}</h3>
                <div dir="ltr" className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-center font-mono text-lg font-semibold dark:border-slate-800 dark:bg-slate-950">{content.unitRateFormula}</div>
                <ul className="grid gap-3 text-sm sm:grid-cols-2">{content.unitRateVariables.map((item) => <li key={item}>{item}</li>)}</ul>
                <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{content.unitRateNote}</p>
              </div>
            </section>

            <section>
              <h2 className="mb-8 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.quantityTitle}</h2>
              <div className="space-y-8">
                {content.measurementSections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 text-2xl font-bold">{section.title}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.formulas.map((formula) => <div key={formula} dir="ltr" className="rounded-lg border border-slate-200 bg-white p-3 text-center font-mono dark:border-slate-800 dark:bg-slate-950">{formula}</div>)}
                    </div>
                    {section.details && <ul className="mt-4 list-disc space-y-1 ps-5 text-sm">{section.details.map((item) => <li key={item}>{item}</li>)}</ul>}
                    {section.example && <p className="mt-4 text-sm font-medium">{section.example}</p>}
                    {section.note && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-700 dark:bg-blue-900/20 dark:text-slate-300">{section.note}</p>}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-8 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.costTitle}</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{content.costCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-3 font-bold">{card.title}</h3>
                  <div dir="ltr" className="rounded border border-slate-200 bg-white p-2 text-center font-mono dark:border-slate-800 dark:bg-slate-950">{card.formula}</div>
                  {card.details.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">{card.details.map((item) => <li key={item}>{item}</li>)}</ul>}
                </div>
              ))}</div>
            </section>

            <section>
              <h2 className="mb-8 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.workedTitle}</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900"><tr>{content.tableHeaders.map((item) => <th key={item} scope="col" className="px-4 py-3 text-start font-semibold">{item}</th>)}</tr></thead>
                  <tbody>{content.tableRows.map((row) => <tr key={row.join("|")} className="border-t border-slate-200 dark:border-slate-800">{row.map((cell, index) => index === 0 ? <th key={cell} scope="row" className="px-4 py-3 text-start font-medium">{cell}</th> : <td key={`${cell}-${index}`} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
                  <tfoot className="bg-slate-100 font-bold dark:bg-slate-900"><tr><th colSpan={4} className="px-4 py-3 text-end">{content.totalLabel}</th><td className="px-4 py-3">{content.totalValue}</td></tr></tfoot>
                </table>
              </div>
              <p className="mt-3 text-center text-sm italic text-slate-500 dark:text-slate-400">{content.ratesNote}</p>
            </section>

            <section>
              <h2 className="mb-6 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.workflowTitle}</h2>
              <ol className="list-decimal space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-8 ps-12 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{content.workflowSteps.map((step) => <li key={step}>{step}</li>)}</ol>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center shadow-sm dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/40 md:p-12">
              <Calculator className="mx-auto mb-6 h-10 w-10 text-blue-600 dark:text-blue-400" />
              <h2 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white">{content.calculatorTitle}</h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600 dark:text-slate-300">{content.calculatorBody}</p>
              <a href="https://www.vistabylara.com/ai-tools/boq-calculator-uae" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg bg-blue-600 px-8 py-4 font-semibold text-white hover:bg-blue-700">{content.calculatorAction}<ArrowRight className="ms-2 h-5 w-5" /></a>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{content.calculatorCaption}</p>
            </section>

            <section>
              <h2 className="mb-8 border-b border-slate-200 pb-2 text-3xl font-bold dark:border-slate-800">{content.faqTitle}</h2>
              <div className="space-y-8">{content.faqs.map((faq) => <div key={faq.question}><h3 className="mb-3 text-xl font-bold">{faq.question}</h3><p className="text-slate-700 dark:text-slate-300">{faq.answer}</p></div>)}</div>
            </section>
          </article>
        </main>
      </div>
    </>
  );
}

export default async function BOQCalculationFormulasPage() {
  const locale = await getServerLocale();
  if (locale === "ar") {
    const t = createTranslator(getDictionary(locale));
    const content = translateStructuredContent<ArabicFormulaContent>(
      t,
      "publicRoutes.boqCalculationFormulas",
      {} as ArabicFormulaContent,
    );
    return <ArabicFormulaPage content={content} />;
  }

  return (
    <>
      <PublicJsonLd data={pageSchema} />
      <div className="flex flex-col min-h-screen bg-[#030508] text-slate-100">
        <PublicBreadcrumb items={[
          { name: "Home", item: "/" },
          { name: "Resources", item: "/resources" },
          { name: "BOQ Formulas", item: "/boq-calculation-formulas" }
        ]} />

        <div className="flex-1 py-12 md:py-20 lg:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <header className="mb-12">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300 mb-6">
              <BookOpen className="mr-2 h-4 w-4" />
              Educational Resource
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white">
              BOQ Calculation Formulas for Construction Quantities and Costs
            </h1>
            <div className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed border-l-4 border-blue-500 pl-6 my-8">
              <p>
                A Bill of Quantities is not calculated with one geometric equation. Quantity surveyors and estimators measure each construction element using the appropriate length, area, volume, weight or count formula, then multiply the reviewed quantity by its approved unit rate. The final BOQ total is the sum of all measured item amounts.
              </p>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 mt-8 text-sm">
              <p className="text-slate-500 dark:text-slate-400">
                <strong>Measurement Rules Note:</strong> Measurement rules vary by country, contract and project. Professionals may be required to follow a specified method of measurement, such as an applicable NRM, CESMM, POMI, SMM or project-specific framework. Users must confirm the required standard independently.
              </p>
              <p className="mt-3 text-slate-500 dark:text-slate-400">
                Authoritative reference: the{" "}
                <a
                  href="https://www.rics.org/content/dam/ricsglobal/documents/standards/nrm_2_detailed_measurement_for_building_works_1st_edition_rics.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 underline dark:text-blue-300"
                >
                  RICS NRM 2 measurement standard
                </a>{" "}
                is one example of a formal measurement framework. This link does not imply RICS approval, certification or endorsement of Quantara.
              </p>
            </div>
          </header>

          <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-blue-600 dark:prose-a:text-blue-400">
            <h2 className="text-3xl mt-12 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">Master BOQ Formulas</h2>
            
            <div className="grid gap-8 md:grid-cols-2">
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-4 mt-0">BOQ Item Amount</h3>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg font-mono text-lg font-semibold text-center mb-4 border border-slate-200 dark:border-slate-800" aria-label="Item Amount equals Quantity multiplied by Unit Rate">
                  A<sub>i</sub> = Q<sub>i</sub> × R<sub>i</sub>
                </div>
                <ul className="text-sm space-y-2 m-0 p-0 list-none">
                  <li><strong>Q<sub>i</sub></strong> = measured quantity for item i</li>
                  <li><strong>R<sub>i</sub></strong> = approved unit rate for item i</li>
                  <li><strong>A<sub>i</sub></strong> = amount for item i</li>
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-4 mt-0">Total BOQ Cost</h3>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg font-mono text-lg font-semibold text-center mb-4 border border-slate-200 dark:border-slate-800" aria-label="Total BOQ Cost equals the sum of all item amounts">
                  C<sub>BOQ</sub> = Σ (Q<sub>i</sub> × R<sub>i</sub>)
                </div>
                <p className="text-sm m-0">Sum of all individual item amounts across the entire project.</p>
              </div>
            </div>

            <h3 className="text-2xl mt-10 mb-4">Unit-Rate Composition</h3>
            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-950 p-4 rounded-lg font-mono text-lg font-semibold text-center mb-4 border border-slate-200 dark:border-slate-800" aria-label="Rate equals Materials plus Labour plus Equipment plus Overheads plus Profit">
                R = M + L + E + OH + P
              </div>
              <ul className="text-sm space-y-2 m-0 p-0 list-none grid sm:grid-cols-2 gap-4">
                <li><strong>M</strong> = material cost</li>
                <li><strong>L</strong> = labour cost</li>
                <li><strong>E</strong> = equipment cost</li>
                <li><strong>OH</strong> = overhead allocation</li>
                <li><strong>P</strong> = profit or margin allowance</li>
              </ul>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                <em>Note: Do not describe this as a universal contractual formula. Project pricing structures may differ.</em>
              </div>
            </div>

            <h2 className="text-3xl mt-16 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2">Quantity Measurement Formulas</h2>

            <div className="space-y-12">
              {/* 1. Earthworks */}
              <section>
                <h3 className="text-2xl mt-0">1. Earthworks and Excavation</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800" aria-label="Volume equals Length multiplied by Width multiplied by Depth">
                    V = L × W × D
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-2 mt-0">Variables</h4>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none">
                        <li><strong>V</strong> = volume in m³</li>
                        <li><strong>L</strong> = length in m</li>
                        <li><strong>W</strong> = width in m</li>
                        <li><strong>D</strong> = depth in m</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-2 mt-0">Example</h4>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none font-mono">
                        <li>L = 20 m</li>
                        <li>W = 1.2 m</li>
                        <li>D = 2 m</li>
                        <li className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">20 × 1.2 × 2 = 48 m³</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 mb-0 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                    <strong>Note:</strong> Excavation quantities may also require allowances for working space, side slopes, disposal, backfilling, bulking or compaction, depending on project requirements.
                  </p>
                </div>
              </section>

              {/* 2. Concrete */}
              <section>
                <h3 className="text-2xl mt-0">2. Concrete</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800" aria-label="Volume equals Length multiplied by Width multiplied by Height">
                    V = L × W × H
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="sm:col-start-2">
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-2 mt-0">Example Slab</h4>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none font-mono">
                        <li>L = 12 m</li>
                        <li>W = 10 m</li>
                        <li>Thickness = 0.15 m</li>
                        <li className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">12 × 10 × 0.15 = 18 m³</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 mb-0">
                    Measure foundations, columns, beams, walls and slabs separately where their dimensions or concrete specifications differ.
                  </p>
                </div>
              </section>

              {/* 3. Masonry */}
              <section>
                <h3 className="text-2xl mt-0">3. Masonry and Blockwork</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h4 className="font-semibold mt-0 mb-3">Wall Area</h4>
                    <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800">
                      A = L × H
                    </div>
                    <h4 className="font-semibold mt-0 mb-3">Net Wall Area</h4>
                    <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                      A<sub>net</sub> = (L × H) - A<sub>openings</sub>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <h4 className="font-semibold mt-0 mb-3">Approximate Block Count</h4>
                    <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800">
                      N = A<sub>net</sub> ÷ A<sub>block face</sub>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                      Where mortar joints or a manufacturer module affect the effective block area, the estimator must use the approved modular dimensions.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. Plaster & 5. Painting */}
              <div className="grid md:grid-cols-2 gap-6">
                <section>
                  <h3 className="text-2xl mt-0">4. Plaster</h3>
                  <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 h-full">
                    <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800">
                      A<sub>plaster</sub> = (L × H) - A<sub>excluded openings</sub>
                    </div>
                    <ul className="text-sm space-y-2 m-0 p-0 pl-4">
                      <li>measure each applicable face;</li>
                      <li>distinguish internal and external finishes;</li>
                      <li>apply opening deductions according to the project measurement method;</li>
                      <li>include returns, reveals or soffits where required.</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h3 className="text-2xl mt-0">5. Painting</h3>
                  <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 h-full">
                    <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-2 border border-slate-200 dark:border-slate-800">
                      A<sub>paint</sub> = A<sub>surface</sub> - A<sub>excluded openings</sub>
                    </div>
                    <p className="text-sm mb-2 mt-4 font-semibold">For a simple wall:</p>
                    <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800">
                      A<sub>paint</sub> = (L × H) - A<sub>openings</sub>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                      Coats, primers, surface preparation, texture and substrate type affect the rate, not only the measured area.
                    </p>
                  </div>
                </section>
              </div>

              {/* 6. Floor tiles */}
              <section>
                <h3 className="text-2xl mt-0">6. Floor Tiles</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <h4 className="font-semibold text-sm mb-2 mt-0">Floor Area</h4>
                      <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                        A<sub>floor</sub> = L × W
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2 mt-0">Approximate Tile Count</h4>
                      <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                        N<sub>tiles</sub> = A<sub>floor</sub> ÷ A<sub>one tile</sub>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2 mt-0">Waste-Adjusted Quantity</h4>
                      <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                        N<sub>adjusted</sub> = N<sub>tiles</sub> × (1 + w)
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1">
                      <p className="text-sm m-0">Where <strong>w</strong> is the approved waste percentage as a decimal.</p>
                      <ul className="text-sm font-mono mt-2 mb-0">
                        <li>5% waste: w = 0.05</li>
                        <li>10% waste: w = 0.10</li>
                      </ul>
                    </div>
                    <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-900/50">
                      Waste allowances commonly vary by layout, tile size, pattern, cutting, breakage and project requirements.
                    </div>
                  </div>
                </div>
              </section>

              {/* 7. Ceilings */}
              <section>
                <h3 className="text-2xl mt-0">7. Ceilings</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold mb-2 mt-0">For a simple horizontal ceiling:</h4>
                  <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center mb-4 border border-slate-200 dark:border-slate-800 max-w-sm">
                    A = L × W
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                    Bulkheads, drops, coffers, access panels, perimeter details and different ceiling systems should be measured separately.
                  </p>
                </div>
              </section>

              {/* 8. Reinforcement steel */}
              <section>
                <h3 className="text-2xl mt-0">8. Reinforcement Steel</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="mb-4 mt-0 font-medium">Use the standard estimating approximation:</p>
                  
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="font-semibold text-sm mb-2 mt-0">Unit weight of bar in kg/m</h4>
                      <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center border border-slate-200 dark:border-slate-800" aria-label="w equals D squared divided by 162">
                        w = D² ÷ 162
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2 mt-0">Total bar weight</h4>
                      <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center border border-slate-200 dark:border-slate-800" aria-label="W equals D squared divided by 162, all multiplied by L">
                        W = (D² ÷ 162) × L
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none">
                        <li><strong>D</strong> = nominal bar diameter in mm</li>
                        <li><strong>L</strong> = total bar length in m</li>
                        <li><strong>W</strong> = approximate weight in kg</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-2 mt-0">Example</h4>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none font-mono">
                        <li>Diameter = 16 mm</li>
                        <li>Total length = 20 m</li>
                        <li className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">(16² ÷ 162) × 20 ≈ 31.6 kg</li>
                      </ul>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-6 mb-0 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                    <strong>Note:</strong> Final reinforcement quantities should account for bar schedules, laps, hooks, bends, couplers, chairs, wastage and approved detailing.
                  </p>
                </div>
              </section>

              {/* 9. Formwork */}
              <section>
                <h3 className="text-2xl mt-0">9. Formwork</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-full md:w-1/3">
                    <h4 className="font-semibold mb-2 mt-0">Basic contact area</h4>
                    <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                      A = L × H
                    </div>
                  </div>
                  <div className="w-full md:w-2/3">
                    <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                      Formwork is measured by the concrete-contact surface. Slab soffits, beam sides, beam soffits, column faces, wall faces and foundation sides should be measured according to the applicable project rules.
                    </p>
                  </div>
                </div>
              </section>

              {/* 10. Roofing */}
              <section>
                <h3 className="text-2xl mt-0">10. Roofing</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-semibold mb-2 mt-0">Plan-area approximation</h4>
                      <div className="font-mono bg-white dark:bg-slate-950 p-4 rounded-lg text-center mb-6 border border-slate-200 dark:border-slate-800">
                        A<sub>roof</sub> = L × W × F<sub>pitch</sub>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                        These are geometric approximations. Use actual sloped dimensions or approved drawings where available, and measure hips, valleys, ridges, laps and accessories separately.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 mt-0">Illustrative Pitch Factors</h4>
                      <table className="w-full text-sm text-left border-collapse">
                        <caption className="sr-only">Illustrative roof pitch factors</caption>
                        <tbody>
                          <tr className="border-b border-slate-200 dark:border-slate-800"><th scope="row" className="py-2 font-medium">Flat</th><td className="py-2 text-right font-mono">1.00</td></tr>
                          <tr className="border-b border-slate-200 dark:border-slate-800"><th scope="row" className="py-2 font-medium">15°</th><td className="py-2 text-right font-mono">approx. 1.04</td></tr>
                          <tr className="border-b border-slate-200 dark:border-slate-800"><th scope="row" className="py-2 font-medium">30°</th><td className="py-2 text-right font-mono">approx. 1.15</td></tr>
                          <tr><th scope="row" className="py-2 font-medium">45°</th><td className="py-2 text-right font-mono">approx. 1.41</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* 11. Asphalt */}
              <section>
                <h3 className="text-2xl mt-0">11. Asphalt</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="font-semibold mt-0 mb-2">Volume</h4>
                      <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                        V = L × W × T
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mt-0 mb-2">Mass</h4>
                      <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800">
                        M = V × ρ
                      </div>
                    </div>
                  </div>
                  <ul className="text-sm space-y-1 mb-4 p-0 list-none pl-2">
                    <li><strong>T</strong> = compacted thickness in m</li>
                    <li><strong>ρ</strong> = approved mix density in t/m³</li>
                  </ul>
                  <p className="text-sm text-slate-600 dark:text-slate-400 m-0 italic">
                    A density such as 2.35 t/m³ is illustrative only. Use the approved asphalt mix density or supplier data for the project.
                  </p>
                </div>
              </section>

              {/* 12. Pipes */}
              <section>
                <h3 className="text-2xl mt-0">12. Pipes</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold mb-2 mt-0">Basic pipe quantity</h4>
                  <div className="font-mono text-sm bg-white dark:bg-slate-950 p-3 rounded-lg text-center mb-6 border border-slate-200 dark:border-slate-800 max-w-sm">
                    Q<sub>pipe</sub> = measured pipe length
                  </div>
                  <h4 className="font-semibold mb-2 mt-0 text-sm">Accessories should be counted separately where required:</h4>
                  <ul className="text-sm columns-2 md:columns-3 m-0 list-disc pl-5">
                    <li>elbows</li>
                    <li>tees</li>
                    <li>valves</li>
                    <li>reducers</li>
                    <li>flanges</li>
                    <li>supports</li>
                    <li>fittings</li>
                    <li>insulation</li>
                    <li>testing and commissioning items</li>
                  </ul>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-4 mb-0 font-medium">
                    Do not imply that the pipe length automatically includes fittings.
                  </p>
                </div>
              </section>

              {/* 13. Structural steel */}
              <section>
                <h3 className="text-2xl mt-0">13. Structural Steel</h3>
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-lg bg-white dark:bg-slate-950 p-4 rounded-lg text-center mb-6 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto">
                    W = L × w<sub>u</sub>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <ul className="text-sm space-y-1 m-0 p-0 list-none">
                        <li><strong>L</strong> = member length</li>
                        <li><strong>w<sub>u</sub></strong> = unit weight from an approved steel-section table</li>
                        <li><strong>W</strong> = total member weight</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 m-0">
                        Plates, bolts, welds, connections, stiffeners, coatings, fabrication loss and erection requirements may need separate measurement or rate allowances.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <h2 className="text-3xl mt-16 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2">Cost Formulas</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-sm uppercase tracking-wider mb-3 mt-0">Material Cost</h4>
                <div className="font-mono bg-white dark:bg-slate-950 p-2 rounded text-center text-sm border border-slate-200 dark:border-slate-800 mb-3">
                  C<sub>M</sub> = Q<sub>M</sub> × P<sub>M</sub>
                </div>
                <ul className="text-xs space-y-1 m-0 p-0 list-none text-slate-600 dark:text-slate-400">
                  <li><strong>Q<sub>M</sub></strong> = material quantity</li>
                  <li><strong>P<sub>M</sub></strong> = material unit price</li>
                </ul>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-sm uppercase tracking-wider mb-3 mt-0">Labour Cost</h4>
                <div className="font-mono bg-white dark:bg-slate-950 p-2 rounded text-center text-sm border border-slate-200 dark:border-slate-800 mb-3">
                  C<sub>L</sub> = H<sub>L</sub> × R<sub>L</sub>
                </div>
                <ul className="text-xs space-y-1 m-0 p-0 list-none text-slate-600 dark:text-slate-400">
                  <li><strong>H<sub>L</sub></strong> = labour hours</li>
                  <li><strong>R<sub>L</sub></strong> = labour hourly rate</li>
                </ul>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-sm uppercase tracking-wider mb-3 mt-0">Equipment Cost</h4>
                <div className="font-mono bg-white dark:bg-slate-950 p-2 rounded text-center text-sm border border-slate-200 dark:border-slate-800 mb-3">
                  C<sub>E</sub> = H<sub>E</sub> × R<sub>E</sub>
                </div>
                <ul className="text-xs space-y-1 m-0 p-0 list-none text-slate-600 dark:text-slate-400">
                  <li><strong>H<sub>E</sub></strong> = equipment hours</li>
                  <li><strong>R<sub>E</sub></strong> = rental/operating rate</li>
                </ul>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 sm:col-span-2 lg:col-span-1">
                <h4 className="font-bold text-sm uppercase tracking-wider mb-3 mt-0">Final Item Cost</h4>
                <div className="font-mono bg-white dark:bg-slate-950 p-2 rounded text-center text-sm border border-slate-200 dark:border-slate-800">
                  C<sub>item</sub> = Q × R
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 p-5 rounded-xl border border-blue-200 dark:border-blue-800/50 sm:col-span-2">
                <h4 className="font-bold text-sm uppercase tracking-wider mb-3 mt-0 text-blue-900 dark:text-blue-100">Project Total</h4>
                <div className="font-mono bg-white dark:bg-slate-950 p-3 rounded text-center border border-blue-200 dark:border-blue-800/50">
                  C<sub>project</sub> = Σ (Q<sub>i</sub> × R<sub>i</sub>)
                </div>
              </div>
            </div>

            <h2 className="text-3xl mt-16 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2">Worked BOQ Example</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
              <table className="w-full text-sm text-left m-0 border-collapse">
                <caption className="sr-only">Illustrative worked BOQ item and amount example</caption>
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 dark:border-slate-800">Item</th>
                    <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 dark:border-slate-800 text-right">Quantity</th>
                    <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 dark:border-slate-800">Unit</th>
                    <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 dark:border-slate-800 text-right">Illustrative Rate</th>
                    <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 dark:border-slate-800 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr className="bg-white dark:bg-slate-950">
                    <th scope="row" className="px-6 py-4 text-left font-medium">Excavation</th>
                    <td className="px-6 py-4 text-right font-mono">48</td>
                    <td className="px-6 py-4">m³</td>
                    <td className="px-6 py-4 text-right font-mono">AED 20</td>
                    <td className="px-6 py-4 text-right font-mono">AED 960</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <th scope="row" className="px-6 py-4 text-left font-medium">Concrete</th>
                    <td className="px-6 py-4 text-right font-mono">18</td>
                    <td className="px-6 py-4">m³</td>
                    <td className="px-6 py-4 text-right font-mono">AED 140</td>
                    <td className="px-6 py-4 text-right font-mono">AED 2,520</td>
                  </tr>
                  <tr className="bg-white dark:bg-slate-950">
                    <th scope="row" className="px-6 py-4 text-left font-medium">Reinforcement</th>
                    <td className="px-6 py-4 text-right font-mono">3,200</td>
                    <td className="px-6 py-4">kg</td>
                    <td className="px-6 py-4 text-right font-mono">AED 1.50</td>
                    <td className="px-6 py-4 text-right font-mono">AED 4,800</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <th scope="row" className="px-6 py-4 text-left font-medium">Blockwork</th>
                    <td className="px-6 py-4 text-right font-mono">240</td>
                    <td className="px-6 py-4">m²</td>
                    <td className="px-6 py-4 text-right font-mono">AED 35</td>
                    <td className="px-6 py-4 text-right font-mono">AED 8,400</td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold">
                  <tr>
                    <th scope="row" colSpan={4} className="px-6 py-4 text-right text-base">Total:</th>
                    <td className="px-6 py-4 text-right text-base text-blue-600 dark:text-blue-400 font-mono">AED 16,680</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center mb-12">
              Illustrative rates only. These values are not current UAE market rates, quotations or pricing recommendations.
            </p>

            <h2 className="text-3xl mt-16 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">Professional Measurement Workflow</h2>
            <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 mb-12">
              <ol className="space-y-3 m-0 pl-5 text-slate-700 dark:text-slate-300">
                <li>Review the project drawings, specifications, schedules and revisions.</li>
                <li>Identify the relevant construction elements and measurement units.</li>
                <li>Apply the correct length, area, volume, weight or count method.</li>
                <li>Record assumptions, deductions, waste and source references.</li>
                <li>Apply approved unit rates that reflect the agreed cost components.</li>
                <li>Review every quantity and rate professionally.</li>
                <li>Sum the item amounts to produce the BOQ total.</li>
                <li>Preserve revision identifiers and available source references.</li>
              </ol>
            </div>

            {/* CTA Section */}
            <div className="my-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl p-8 md:p-12 border border-blue-100 dark:border-blue-900/50 shadow-sm text-center">
              <div className="inline-flex items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
                <Calculator className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold mt-0 mb-4 text-slate-900 dark:text-white">Use the Free BOQ Calculator</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                Apply practical quantity and cost formulas using the free BOQ Calculator developed by Vista By Lara. The calculator is an external educational planning tool and does not replace professional measurement, rate validation or contractual review.
              </p>
              
              <div className="flex flex-col items-center gap-3">
                <a 
                  href="https://www.vistabylara.com/ai-tools/boq-calculator-uae" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition-colors duration-200 no-underline group"
                >
                  Open the Free BOQ Calculator
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </a>
                <span className="text-sm text-slate-500 dark:text-slate-400">External tool by Vista By Lara</span>
              </div>
            </div>

            <h2 className="text-3xl mt-16 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2">Frequently Asked Questions</h2>
            <div className="space-y-8">
              {formulaFaqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="text-xl font-bold mb-3 mt-0">{faq.question}</h3>
                  <p className="m-0 text-slate-700 dark:text-slate-300">{faq.answer}</p>
                </div>
              ))}
            </div>

          </article>
        </div>
      </div>
    </>
  );
}
