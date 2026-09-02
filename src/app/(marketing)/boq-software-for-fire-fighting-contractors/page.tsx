import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-for-fire-fighting-contractors", locale);
}



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "Fire-Fighting BOQ Software",
    title: "Fire-Fighting BOQ Software for Structured Project and Estimating Workflows",
    audienceDescription: "For fire-fighting and life-safety contractors managing highly technical equipment schedules, piping, and system BOQs.",
    directAnswer: "Quantara helps fire-fighting contractors organize supported BOQ items, equipment schedules and revision records for professional review.",
    challenges: [
  {
    "title": "Technical Complexity",
    "description": "Life-safety BOQs contain specific equipment, valves and specialized piping that must be checked carefully against consultant documents."
  },
  {
    "title": "Strict Revision Management",
    "description": "Changes to fire-protection scope require rigorous documentation to ensure the final tender matches the approved safety strategy."
  }
],
    workflowDescription: "Quantara helps teams organize supported items for pumps, sprinkler systems, specialized piping, valves, hose reels, extinguishers and accessories. Contractors must compare every technical schedule and revision with the source scope.",
    workflowExample: "A fire-fighting contractor reviews a consultant BOQ alongside revised pump schedules. Supported information from text-based schedules is captured for review, organized into the BOQ and retained in a distinct revision record before the proposal is checked.",
    typicalCategories: [
  "Fire Pumps and Equipment",
  "Sprinkler Systems",
  "Fire Fighting Piping",
  "Valves and Accessories",
  "Hose Reels and Cabinets",
  "Fire Extinguishers",
  "Testing and Commissioning"
],
    supportedInputs: [
  "Text-based PDF",
  "Scanned PDF (detection only — OCR not currently available)",
  "XLSX",
  "CSV"
],
    plannedInputs: [
  "CAD",
  "BIM",
  "IFC"
],
    supportedOutputs: [
  "Structured Excel (XLSX)",
  "Formatted PDF Proposals",
  "CSV Exports"
],
    limitations: [
  "Quantara does not claim standards compliance or automatic engineering validation.",
  "Quantara does not provide hydraulic calculations or design software.",
  "All extracted life-safety scope must be reviewed by a qualified professional."
],
    faqs: [
  {
    "question": "Does Quantara validate fire-protection compliance?",
    "answer": "No, Quantara is purely a document workflow tool. It does not provide code compliance certification or engineering approval."
  },
  {
    "question": "Can I extract pump equipment schedules?",
    "answer": "If a text-based PDF contains a supported detected table, its rows can become review candidates. A professional must verify the technical specifications and structure accepted items; scanned schedules require manual transcription because OCR text extraction is not currently available."
  },
  {
    "question": "How are valves and accessories managed?",
    "answer": "They are managed as standard BOQ items with specific descriptions and quantities, organized within your chosen sections."
  },
  {
    "question": "Does Quantara perform hydraulic calculations?",
    "answer": "No, Quantara does not perform engineering calculations. It only manages the BOQ document structure."
  },
  {
    "question": "Can I track testing and commissioning?",
    "answer": "Yes, testing and commissioning should be structured as specific items or sections within the BOQ."
  },
  {
    "question": "Is it suitable for sprinkler system BOQs?",
    "answer": "The platform can organize supported sprinkler-system items, including pipework and heads, when they are present in supported source data or entered by a professional."
  },
  {
    "question": "How do you handle consultant revisions?",
    "answer": "Quantara retains distinct BOQ revision records. A professional must compare them and apply the relevant consultant instructions."
  },
  {
    "question": "Can I export a professional proposal?",
    "answer": "A supported PDF output can be generated from reviewed BOQ data and an available template. It still requires professional checking before issue."
  }
],
    relatedPages: [
  {
    "href": "/boq-software-for-mep-contractors",
    "label": "BOQ Software for MEP Contractors"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "How to Review AI-Extracted BOQ"
  },
  {
    "href": "/features",
    "label": "Features"
  }
],
    path: "/boq-software-for-fire-fighting-contractors"
  };

  return <IndustryLandingPage content={content} />;
}
