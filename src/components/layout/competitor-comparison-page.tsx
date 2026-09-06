import Link from "next/link";
import PublicJsonLd from "@/components/seo/public-json-ld";
import PublicBreadcrumb from "@/components/ui/public-breadcrumb";
import { getQuantaraProductTruthForDisplay } from "@/lib/public-site/product-truth";
import { buildPublicPageGraph } from "@/lib/public-site/schema";
import { getPublicSearchPage, type PublicSearchPath } from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";

type CompetitorSlug = "togal-ai" | "kreo" | "costx" | "autodesk-takeoff";

type CompetitorData = {
  name: string;
  officialUrl: string;
  officialPosition: string;
  h1: string;
  answer: string;
  bestForCompetitor: string[];
  bestForQuantara: string[];
  criteria: Array<{ label: string; competitor: string; quantara: string }>;
  buyerQuestions: Array<{ question: string; answer: string }>;
};

const SHARED_QUANTARA_FIT = [
  "Your starting point is an industry selection and a complete drawing set.",
  "You need a structured, quantity-complete unpriced BOQ rather than only drawing markups.",
  "Every quantity should carry calculation evidence, drawing provenance, assumptions and unresolved evidence for review.",
  "Your team wants to add its own rates, govern revisions, lock reviewed work and produce client-facing documents.",
];

const DATA: Record<CompetitorSlug, CompetitorData> = {
  "togal-ai": {
    name: "Togal.AI",
    officialUrl: "https://www.togal.ai/features",
    officialPosition: "Togal.AI presents an AI-powered construction takeoff platform focused on automatically detecting, measuring, comparing and labeling drawing information, with collaboration and takeoff tools.",
    h1: "Quantara vs Togal.AI: Which Takeoff Workflow Fits?",
    answer: "Choose Togal.AI when fast visual takeoff and drawing measurement are the primary requirement. Choose Quantara when the required result is a governed, quantity-complete unpriced BOQ with evidence, assumptions, revisions and professional outputs across supported industries.",
    bestForCompetitor: ["AI-assisted visual takeoff on construction drawings.", "Teams centered on measuring, counting and marking up plans.", "Estimators who want takeoff collaboration around drawing sets."],
    bestForQuantara: SHARED_QUANTARA_FIT,
    criteria: [
      { label: "Primary workflow", competitor: "AI-powered drawing takeoff and measurement.", quantara: "Drawing-set intake through structured unpriced BOQ preparation and review." },
      { label: "Starting point", competitor: "Upload plans and perform or refine takeoff.", quantara: "Select a supported industry and upload the complete drawing set." },
      { label: "Core result", competitor: "Measured and marked-up takeoff information.", quantara: "Sectioned, quantity-complete unpriced BOQ with zero rates ready for professional pricing." },
      { label: "Evidence", competitor: "Drawing-centered measurement and markup context.", quantara: "Calculation evidence, source provenance, confidence, assumptions and unresolved evidence." },
      { label: "Commercial workflow", competitor: "Takeoff information supports downstream estimating.", quantara: "Rates, revisions, locking, BOQ documents, proposals and technical reports remain in one governed workflow." },
      { label: "Human control", competitor: "Estimator reviews and adjusts generated takeoff.", quantara: "Engineer confirms quantities and evidence, adds rates and approves final issue." },
    ],
    buyerQuestions: [
      { question: "Is Quantara a Togal.AI alternative?", answer: "Yes for teams whose buying requirement is drawing-to-unpriced-BOQ preparation with traceable evidence and document controls. Togal.AI may be the closer fit when visual drawing takeoff itself is the central workflow." },
      { question: "Does Quantara replace professional review?", answer: "No. Quantara prepares reviewable quantities and evidence; a qualified professional must verify scope, quantities, assumptions, rates and final issue." },
      { question: "Can rates remain private to our company?", answer: "Yes. Quantara keeps generated BOQ rates at zero so the authorized team can apply its own commercial pricing." },
    ],
  },
  kreo: {
    name: "Kreo",
    officialUrl: "https://www.kreo.net/",
    officialPosition: "Kreo presents cloud-based AI takeoff and estimating software with automated measurement, drawing tools, reports and collaborative estimating workflows.",
    h1: "Quantara vs Kreo: AI Takeoff and BOQ Comparison",
    answer: "Choose Kreo when a cloud takeoff-and-estimating workspace with automated measurements is the priority. Choose Quantara when you want the software to organize the complete drawing set into an evidence-backed, unpriced BOQ that your engineer reviews and prices.",
    bestForCompetitor: ["Cloud-based quantity takeoff and estimating.", "Automated measurement plus manual takeoff tools.", "Teams that want drawing, report and estimate collaboration."],
    bestForQuantara: SHARED_QUANTARA_FIT,
    criteria: [
      { label: "Primary workflow", competitor: "AI takeoff, measurement and estimating in the cloud.", quantara: "Industry-aware drawing-to-unpriced-BOQ preparation." },
      { label: "Starting point", competitor: "Import drawings and create measurements or estimates.", quantara: "Choose the industry and provide the complete drawing set." },
      { label: "Core result", competitor: "Takeoff measurements, reports and estimating data.", quantara: "A reviewable BOQ with sections, items, units, quantities and zero rates." },
      { label: "Evidence model", competitor: "Measurements remain connected to takeoff drawings and reports.", quantara: "Each quantity carries its calculation basis, drawing source, confidence and exceptions." },
      { label: "Outputs", competitor: "Takeoff and estimate reporting workflows.", quantara: "BOQ, proposal, technical report, HTML preview and client portal after review." },
      { label: "Pricing control", competitor: "Estimating is part of the published platform workflow.", quantara: "Quantities are prepared without regional rates; the user's authorized team prices them." },
    ],
    buyerQuestions: [
      { question: "Is Quantara a Kreo alternative?", answer: "It can be when the target deliverable is a structured, unpriced BOQ with provenance and controlled issue. Kreo may suit buyers prioritizing a general cloud takeoff and estimating workspace." },
      { question: "Which is designed for a zero-rate BOQ?", answer: "Quantara explicitly prepares quantity-complete BOQs with zero rates so company pricing remains under professional control." },
      { question: "Does Quantara support multiple industries?", answer: "Quantara's governed workflow supports ten registered estimating industries, including construction, fit-out, joinery, MEP, electrical, HVAC, plumbing, firefighting and landscaping-related work." },
    ],
  },
  costx: {
    name: "RIB CostX",
    officialUrl: "https://www.rib-software.com/en/rib-costx",
    officialPosition: "RIB describes CostX as 2D and 3D/BIM takeoff and estimating software with integrated workbooks, revision comparison and estimating capabilities.",
    h1: "Quantara vs RIB CostX: BOQ and Takeoff Comparison",
    answer: "Choose RIB CostX when established 2D/3D measurement, BIM quantities and integrated estimating workbooks are the central need. Choose Quantara when a simpler SaaS journey should turn supported drawing evidence into a structured unpriced BOQ with assumptions, review and client deliverables.",
    bestForCompetitor: ["Detailed 2D drawing and 3D/BIM measurement.", "Experienced estimators working with integrated estimating workbooks.", "Teams that require drawing revision comparison and mature takeoff controls."],
    bestForQuantara: SHARED_QUANTARA_FIT,
    criteria: [
      { label: "Primary workflow", competitor: "2D/3D takeoff and estimating with integrated workbooks.", quantara: "Guided drawing-set intake and autonomous BOQ preparation under engineer control." },
      { label: "Measurement approach", competitor: "Detailed on-screen and model-based measurement tools.", quantara: "Evidence-backed quantity preparation with supported deterministic calculations and professional confirmation." },
      { label: "Core result", competitor: "Measured quantities linked to estimating workbooks.", quantara: "Quantity-complete, sectioned unpriced BOQ prepared for company rates." },
      { label: "Revision handling", competitor: "Published drawing comparison and revision tools.", quantara: "BOQ revision records, review decisions and locking before issue." },
      { label: "Deployment emphasis", competitor: "Professional estimating platform with specialist training depth.", quantara: "Browser-based SaaS workflow designed for guided adoption across supported industries." },
      { label: "Deliverables", competitor: "Takeoff and estimating outputs from CostX workbooks.", quantara: "BOQ, proposal, technical report, HTML preview and client portal." },
    ],
    buyerQuestions: [
      { question: "Is Quantara a CostX alternative?", answer: "It is an alternative for teams prioritizing evidence-led drawing-to-unpriced-BOQ automation and a browser-based review workflow. It is not a claim to reproduce every advanced CostX 2D, 3D or BIM measurement feature." },
      { question: "Can Quantara import CostX information?", answer: "Quantara lists CostX as a file-import workflow. Buyers should verify the exact supported file format and project requirement before purchase." },
      { question: "Which tool is better for BIM measurement?", answer: "RIB CostX is the clearer fit when direct specialist 3D/BIM measurement is mandatory. Quantara is positioned around governed drawing-to-BOQ preparation and professional outputs." },
    ],
  },
  "autodesk-takeoff": {
    name: "Autodesk Takeoff",
    officialUrl: "https://construction.autodesk.com/products/autodesk-takeoff/",
    officialPosition: "Autodesk presents Takeoff as cloud-based 2D and 3D quantification connected to Autodesk Construction Cloud, with aggregated quantities and team access to project data.",
    h1: "Quantara vs Autodesk Takeoff: Quantity Workflow Comparison",
    answer: "Choose Autodesk Takeoff when 2D and 3D quantification inside Autodesk Construction Cloud is essential. Choose Quantara when the priority is an industry-aware, quantity-complete unpriced BOQ with calculation evidence, assumptions, revisions and professional document production.",
    bestForCompetitor: ["2D and 3D quantification in Autodesk Construction Cloud.", "Teams already standardized on Autodesk project data and models.", "Estimators who need aggregated takeoff quantities from drawings and models."],
    bestForQuantara: SHARED_QUANTARA_FIT,
    criteria: [
      { label: "Primary workflow", competitor: "Cloud 2D/3D takeoff within the Autodesk ecosystem.", quantara: "Industry selection, drawing evidence and structured unpriced BOQ preparation." },
      { label: "Source emphasis", competitor: "Sheets and 3D models managed in Autodesk Construction Cloud.", quantara: "Complete drawing sets and supported source files with provenance recorded for review." },
      { label: "Core result", competitor: "Aggregated 2D and 3D takeoff quantities.", quantara: "Sectioned BOQ items with quantities, units, evidence, assumptions and zero rates." },
      { label: "Ecosystem", competitor: "Strong fit for Autodesk Construction Cloud users.", quantara: "Independent SaaS BOQ workflow with DWG candidate analysis under controlled access." },
      { label: "Commercial control", competitor: "Quantities support Autodesk-connected estimating workflows.", quantara: "Company rates and final commercial decisions remain with authorized professionals." },
      { label: "Outputs", competitor: "Takeoff packages and connected construction data.", quantara: "Reviewed BOQ, proposal, technical report, HTML preview and client portal." },
    ],
    buyerQuestions: [
      { question: "Is Quantara an Autodesk Takeoff alternative?", answer: "It can be for contractors who need drawing-to-unpriced-BOQ preparation without making Autodesk Construction Cloud or direct model quantification the center of the workflow." },
      { question: "Does Quantara provide full BIM model takeoff?", answer: "No blanket full-model takeoff claim is made. Controlled Autodesk/DWG candidate analysis can support review, while specialist model workflows must be verified for the project." },
      { question: "Which is better outside the Autodesk ecosystem?", answer: "Quantara is designed as an independent BOQ SaaS workflow. Autodesk Takeoff is naturally stronger for organizations already centered on Autodesk Construction Cloud." },
    ],
  },
};

export async function CompetitorComparisonPage({ competitor }: { competitor: CompetitorSlug }) {
  const data = DATA[competitor];
  const path = `/quantara-vs-${competitor}` as PublicSearchPath;
  const searchPage = getPublicSearchPage(path);
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  const { professionalReviewNotice } = getQuantaraProductTruthForDisplay(t);
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Comparisons", path: "/comparisons" },
    { name: `Quantara vs ${data.name}`, path },
  ];
  const schema = buildPublicPageGraph({
    path,
    title: searchPage.title,
    description: searchPage.description,
    breadcrumbs,
    faqs: data.buyerQuestions,
  });

  return (
    <main className="min-h-screen bg-[#030508] px-4 py-20 text-slate-300 sm:px-6">
      <PublicJsonLd data={schema} />
      <div className="mx-auto max-w-6xl">
        <PublicBreadcrumb items={breadcrumbs.map(({ name, path: item }) => ({ name, item }))} tone="dark" />
        <header className="py-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">Independent workflow comparison</p>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white md:text-6xl">{data.h1}</h1>
          <p className="mt-7 max-w-4xl border-s-4 border-blue-500 bg-slate-900/60 p-5 text-lg leading-8">{data.answer}</p>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400">{professionalReviewNotice}</p>
        </header>

        <section className="mb-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-7">
            <h2 className="text-2xl font-bold text-white">Choose {data.name} when</h2>
            <ul className="mt-5 space-y-3">{data.bestForCompetitor.map((item) => <li key={item}>• {item}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-blue-900 bg-blue-950/20 p-7">
            <h2 className="text-2xl font-bold text-white">Choose Quantara when</h2>
            <ul className="mt-5 space-y-3">{data.bestForQuantara.map((item) => <li key={item}>• {item}</li>)}</ul>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-3 text-3xl font-bold text-white">Capability-by-capability comparison</h2>
          <p className="mb-7 max-w-4xl leading-7">This comparison distinguishes product workflow—not a universal winner. It uses the competitor&apos;s own published positioning and Quantara&apos;s verified public capability register.</p>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-slate-900"><tr><th className="p-4 text-start text-white">Decision factor</th><th className="p-4 text-start text-white">{data.name}</th><th className="p-4 text-start text-white">Quantara</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{data.criteria.map((row) => <tr key={row.label} className="align-top"><th scope="row" className="p-4 text-start font-semibold text-white">{row.label}</th><td className="p-4 leading-7">{row.competitor}</td><td className="p-4 leading-7">{row.quantara}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mb-16 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">Source and comparison policy</h2>
            <span className="text-sm text-slate-400">Fact-checked 6 September 2026</span>
          </div>
          <p className="mt-4 leading-7">{data.officialPosition}</p>
          <a className="mt-4 inline-block font-semibold text-blue-400 underline underline-offset-4 hover:text-blue-300" href={data.officialUrl} target="_blank" rel="noopener noreferrer">Check {data.name}&apos;s official product page</a>
          <p className="mt-5 text-sm leading-6 text-slate-400">Quantara is not affiliated with {data.name}. Features and plans can change; verify current requirements directly with each vendor before purchasing.</p>
        </section>

        <section className="mb-16">
          <h2 className="mb-7 text-3xl font-bold text-white">Buyer questions</h2>
          <div className="space-y-5">{data.buyerQuestions.map((faq) => <article key={faq.question} className="rounded-xl border border-slate-800 p-6"><h3 className="text-xl font-semibold text-white">{faq.question}</h3><p className="mt-3 leading-7">{faq.answer}</p></article>)}</div>
        </section>

        <section className="rounded-2xl border border-blue-900 bg-blue-950/20 p-9 text-center">
          <h2 className="text-3xl font-bold text-white">Test the workflow against your real requirement</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7">Discuss your industry, drawing formats, review controls and required BOQ outputs before selecting a platform.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-4"><Link href="/contact-sales" className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Contact Sales</Link><Link href="/quantity-takeoff-vs-boq-software" className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-white hover:bg-slate-900">Compare all platforms</Link></div>
        </section>
      </div>
    </main>
  );
}
