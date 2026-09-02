import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-qatar", locale);
}

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Qatar Tender Revisions",
    directDefinition: "Qatar bidders may need company classification, official e-tender activity, consultant BOQ review and tender-security records to proceed on separate tracks. Quantara organizes supported schedules and revisions for professional checking, but it does not classify a contractor, submit a bid or validate Ashghal requirements.",
    audience: {
      heading: "For Qatar Classified Contractors and Tender Teams",
      content: "This workflow supports commercial teams handling consultant-issued schedules and addenda while preserving a clear boundary around government classification, portal submission, tender securities and technical approval.",
      items: [
        "Contractors mapping consultant-issued BOQ and price schedules",
        "Suppliers separating company-classification evidence from commercial records",
        "Infrastructure bid teams reviewing Ashghal notices and addenda",
        "MEP estimators coordinating discipline schedules before professional sign-off"
      ]
    },
    workflowProblem: {
      heading: "Classification, Tender Security and BOQ Scope Need Separate Checks",
      paragraphs: [
        <>
          Qatar&apos;s official{" "}
          <a href="https://monaqasat.mof.gov.qa/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            unified government procurement website
          </a>
          {" "}publishes company-classification and electronic tender services. The Public Works Authority also publishes its own{" "}
          <a href="https://www.ashghal.gov.qa/en/Tenders/pages/ParticipationTerms.aspx" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            tender participation terms
          </a>
          . Those official steps are separate from organizing a consultant&apos;s BOQ for pricing.
        </>,
        "If classification evidence, tender bonds, technical submissions and priced BOQ revisions are treated as one status, a team can mistake an internally reviewed schedule for an eligible or complete bid. Each record needs its own owner and approval."
      ]
    },
    quantaraSupport: {
      heading: "Consultant BOQ Review Without Portal or Bond Management",
      paragraphs: [
        "Quantara can map supported spreadsheet columns, retain distinct BOQ revisions and keep available source references alongside reviewed project records.",
        "The bidder must still confirm company classification, purchase or access tender documents, arrange guarantees, interpret Ashghal or other entity requirements and submit through the authorized portal. Quantara performs none of those official functions."
      ]
    },
    relevantFeatures: [
      { name: "Consultant Schedule Mapping", capabilityId: "spreadsheet-import", description: "Map supported XLSX or CSV fields and approve validated rows into the intended BOQ destination." },
      { name: "Tender Addendum Revisions", capabilityId: "boq-management", description: "Retain distinct BOQ issues while professionals determine the effect of each clarification or addendum." },
      { name: "Available Source Evidence", capabilityId: "source-attribution", description: "Keep available source identity and references with supported records for later checking." }
    ],
    workflowExample: {
      heading: "Example: Qatar Consultant BOQ and Addendum",
      introduction: "A classified contractor obtains the official tender documents externally and receives a later consultant addendum:",
      steps: [
        { title: "Confirm External Eligibility", description: "The bid team checks classification, tender access, securities and submission rules in the applicable official process outside Quantara." },
        { title: "Import the Consultant Schedule", description: "Map supported spreadsheet columns, validate rows and approve only the intended BOQ records." },
        { title: "Review the Addendum", description: "Keep the later source and revision distinct while the quantity surveyor identifies affected quantities, descriptions and assumptions." },
        { title: "Prepare the Checked Commercial Output", description: "Generate a supported reviewed output, then complete tender-security and portal-submission steps through the authorized channels." }
      ]
    },
    supportedInputs: [
      { name: "Consultant XLSX or CSV Price Schedule", capabilityId: "spreadsheet-import", description: "Map supported sections, descriptions, units and quantities with row-level validation." },
      { name: "Selectable-Text Tender Addendum", capabilityId: "text-pdf-extraction", description: "Create review candidates only from supported table rows and compare them with the original issue." },
      { name: "Image-Only Tender Page", capabilityId: "scanned-pdf-detection", description: "Detect that the page lacks extractable text and requires manual transcription and review." }
    ],
    supportedOutputs: [
      { name: "Reviewed Consultant BOQ Revision", capabilityId: "boq-management", description: "Keep the confirmed commercial issue distinct from classification, bond and portal records." },
      { name: "Structured XLSX Output", capabilityId: "professional-outputs", description: "Export reviewed BOQ data for the responsible team's controlled downstream use." },
      { name: "Template-Based Tender Document", capabilityId: "document-templates", description: "Apply a supported document template without representing the result as a complete or compliant bid." }
    ],
    limitations: [
      "Quantara does not register or classify companies, purchase tender documents or submit bids through Qatar's unified government procurement website.",
      "The software does not calculate, issue, validate or track tender bonds, performance guarantees or other securities.",
      "Quantara does not interpret Ashghal specifications, confirm tender eligibility or certify technical, contractual or regulatory compliance.",
      "Automatic drawing takeoff, CAD/BIM/IFC import and OCR extraction from scanned pages are not available.",
      "Quantara does not provide Qatar market rates or calculate taxes and fees; every BOQ and output requires independent professional validation."
    ],
    faqs: [
      {
        question: "Can Quantara classify a company or submit a bid on Qatar's procurement portal?",
        answer: <>
          No. Company classification and electronic tender services remain on Qatar&apos;s official{" "}
          <a href="https://monaqasat.mof.gov.qa/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">unified government procurement website</a>
          . Quantara has no verified integration with that system.
        </>,
        schemaAnswer: "No. Quantara does not classify companies or submit bids through Qatar's unified government procurement website and has no verified integration with that system."
      },
      {
        question: "Does Quantara check Ashghal tender participation requirements?",
        answer: <>
          No. Eligible bidders must follow the current official{" "}
          <a href="https://www.ashghal.gov.qa/en/Tenders/pages/ParticipationTerms.aspx" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">Ashghal participation terms</a>
          {" "}and tender documents. Quantara does not validate registration, fees, guarantees or submission compliance.
        </>,
        schemaAnswer: "No. Quantara does not validate Ashghal registration, tender fees, guarantees or submission compliance. Bidders must follow the current official participation terms and tender documents."
      },
      { question: "Can Quantara identify every change in a consultant addendum?", answer: "No. It can preserve supported sources and distinct BOQ revisions, but a qualified professional must compare issues and determine every scope, quantity and commercial effect." },
      { question: "Does Quantara calculate tender bonds or performance guarantees?", answer: "No. Quantara does not calculate, issue or validate tender securities. The bidder and its authorized advisers must follow the current tender requirements." },
      { question: "Can Quantara extract scanned Qatar tender PDFs?", answer: "Quantara can detect image-only pages, but OCR extraction is not currently available. Scanned content requires manual transcription and comparison with the source." }
    ],
    relatedPages: [
      { href: "/gcc-boq-software", label: "GCC BOQ Software", description: "Understand the review-led GCC workflow without claims of local approval or compliance." },
      { href: "/boq-software-for-contractors", label: "BOQ Software for Contractors", description: "Explore structured contractor BOQ records, revisions and professional outputs." },
      { href: "/how-to-review-ai-extracted-boq", label: "Review AI-Extracted BOQ Data", description: "Check sources, descriptions, units, quantities and exceptions before approval." }
    ]
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-qatar" />;
}
