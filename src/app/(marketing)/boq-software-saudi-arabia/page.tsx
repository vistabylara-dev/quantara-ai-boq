import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-saudi-arabia");

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Saudi Arabia Project Records",
    directDefinition: "Saudi project teams can manage government tender notices, multidisciplinary price schedules, addenda and code-review evidence through different systems and owners. Quantara structures supported BOQ records for human review; Etimad submission, Saudi Building Code assessment and contractual approval remain separate.",
    audience: {
      heading: "For Saudi Tender and Multidisciplinary BOQ Teams",
      content: "This workflow is intended for professionals coordinating large or multi-package BOQs while keeping procurement-platform activity, technical-code review and commercial authorization with the responsible Saudi project stakeholders.",
      items: [
        "Suppliers preparing government tender price schedules alongside Etimad activity",
        "Main contractors coordinating civil, architectural and MEP packages",
        "Consultants issuing discipline-specific BOQ clarifications and addenda",
        "Commercial reviewers separating code evidence, pricing assumptions and bid records"
      ]
    },
    workflowProblem: {
      heading: "Keep Procurement, Code Review and Pricing Evidence Distinct",
      paragraphs: [
        <>
          Saudi government tender opportunities can be reviewed through the official{" "}
          <a href="https://portal.etimad.sa/en-us/home/getmostusedservicessection" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            Etimad services
          </a>
          , while the official{" "}
          <a href="https://sbc.gov.sa/En/BC/Pages/BuildingCode/BC.aspx?year=2024" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            Saudi Building Code catalogue
          </a>
          {" "}publishes separate technical-code resources. Neither record is interchangeable with the reviewed commercial BOQ.
        </>,
        "On a multidisciplinary tender, a single addendum may affect selected packages without replacing every earlier source. Teams need a defensible issue register and professional review rather than an assumed automatic merge."
      ]
    },
    quantaraSupport: {
      heading: "Structured Package Review Without Compliance Automation",
      paragraphs: [
        "Quantara can retain available source references, organize BOQ sections and revisions, and surface supported validation findings before a professional output is used.",
        "The responsible Saudi bid team must still read the tender instructions, apply the correct code and contractual requirements, confirm taxes or local-content obligations, and submit through the authorized channel. Quantara does not connect to Etimad or certify Saudi Building Code compliance."
      ]
    },
    relevantFeatures: [
      { name: "Tender Source Attribution", capabilityId: "source-attribution", description: "Keep available source identity and evidence references with supported package records." },
      { name: "Multidisciplinary BOQ Hierarchy", capabilityId: "boq-management", description: "Organize reviewed civil, architectural and MEP sections without claiming automatic coordination." },
      { name: "Pre-Issue Validation Review", capabilityId: "validation", description: "Review supported findings before relying on the BOQ output; this is not regulatory or contractual validation." }
    ],
    workflowExample: {
      heading: "Example: Saudi Government Tender Package",
      introduction: "A contractor obtains a tender package externally, with separate civil and MEP price schedules followed by an addendum:",
      steps: [
        { title: "Record the External Tender Basis", description: "Create the authorized project workspace and identify the notice, package and issue supplied through the official procurement process." },
        { title: "Map Package Schedules", description: "Import supported spreadsheet columns, validate each destination and preserve the intended section hierarchy." },
        { title: "Review the Addendum", description: "Retain the new source separately and have discipline leads identify every affected item, assumption and exclusion." },
        { title: "Validate Before External Submission", description: "Review supported findings and generate a checked output, then complete Etimad, code, guarantee and approval requirements outside Quantara." }
      ]
    },
    supportedInputs: [
      { name: "Multi-Sheet XLSX or CSV Schedule", capabilityId: "spreadsheet-import", description: "Map supported columns and approve validated records into the intended package or BOQ destination." },
      { name: "Selectable-Text Tender BOQ", capabilityId: "text-pdf-extraction", description: "Capture candidates only from supported detected table rows and verify them against the source." },
      { name: "Scanned or Image-Only Tender Page", capabilityId: "scanned-pdf-detection", description: "Detect that text extraction is unavailable so the page can be reviewed manually." }
    ],
    supportedOutputs: [
      { name: "Package-Structured BOQ", capabilityId: "boq-management", description: "Keep reviewed discipline sections, items and revisions in the project record." },
      { name: "Reviewed XLSX or PDF Output", capabilityId: "professional-outputs", description: "Generate a supported professional output from reviewed data for authorized downstream use." },
      { name: "Configured Document Template", capabilityId: "document-templates", description: "Apply a supported template while retaining project-specific checking and approval outside the software." }
    ],
    limitations: [
      "Quantara does not integrate with Etimad, register suppliers, browse opportunities, submit bids or manage government guarantees.",
      "The software does not interpret or certify the Saudi Building Code, municipal requirements, tender conditions or contractual entitlement.",
      "Arabic and RTL presentation is limited to supported authenticated workflows; Quantara does not provide automatic translation, Arabic source parsing or Arabic OCR.",
      "Quantara does not supply Saudi market rates or calculate taxes, local-content scores, deductions or bank guarantees.",
      "Automatic drawing takeoff and CAD/BIM/IFC import are unavailable, and every quantity and output requires independent professional validation."
    ],
    faqs: [
      {
        question: "Does Quantara submit Saudi government tenders through Etimad?",
        answer: <>
          No. Tender discovery and submission remain in the official{" "}
          <a href="https://portal.etimad.sa/en-us/home/getmostusedservicessection" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">Etimad process</a>
          . Quantara can organize supported BOQ records but has no verified Etimad integration.
        </>,
        schemaAnswer: "No. Quantara has no verified Etimad integration and does not discover or submit Saudi government tenders. It can organize supported BOQ records for professional review."
      },
      {
        question: "Does Quantara check the Saudi Building Code?",
        answer: <>
          No. The responsible design and construction professionals must use the applicable official{" "}
          <a href="https://sbc.gov.sa/En/BC/Pages/BuildingCode/BC.aspx?year=2024" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">Saudi Building Code resources</a>
          . Quantara does not interpret, test or certify code compliance.
        </>,
        schemaAnswer: "No. Quantara does not interpret, test or certify Saudi Building Code compliance. The responsible professionals must identify and apply the applicable official requirements."
      },
      { question: "Can Quantara merge every discipline addendum automatically?", answer: "No. Quantara can keep supported sources and distinct BOQ revisions, but discipline leads must identify the affected scope and approve every change." },
      { question: "Can Quantara process Arabic tender documents automatically?", answer: "No. Supported authenticated workflows include limited Arabic and RTL presentation, but Quantara does not provide automatic translation, Arabic source parsing or OCR for scanned Arabic pages." },
      { question: "Does Quantara calculate Saudi taxes, local content or tender guarantees?", answer: "No. Quantara does not calculate taxes, local-content scores, statutory deductions or bank guarantees. The authorized commercial team must follow the current tender and regulatory requirements." }
    ],
    relatedPages: [
      { href: "/gcc-boq-software", label: "GCC BOQ Software", description: "Review the shared GCC workflow boundaries without claims of local approval or rates." },
      { href: "/construction-estimating-software", label: "Construction Estimating Software", description: "Understand how Quantara organizes reviewed estimating inputs without making commercial decisions." },
      { href: "/boq-review-checklist", label: "BOQ Review Checklist", description: "Check scope, quantities, rates, assumptions, exclusions and revision status before issue." }
    ]
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-saudi-arabia" />;
}
