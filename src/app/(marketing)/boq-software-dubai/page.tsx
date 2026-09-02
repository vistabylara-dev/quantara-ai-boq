import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-dubai", locale);
}

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Dubai Construction Workflows",
    directDefinition: "Dubai bid teams can receive price schedules, consultant addenda, fit-out packages and authority documents on different issue cycles. Quantara keeps supported sources and BOQ revisions organized for review, while procurement submission, permit approval and contractual decisions remain outside the software.",
    audience: {
      heading: "For Dubai Bid, Fit-Out and MEP Review Teams",
      content: "This workflow is designed for construction professionals who need to separate the commercial BOQ issue from procurement-portal records and authority-approval documents. Every captured item and generated output remains subject to qualified review.",
      items: [
        "Main contractors reconciling employer or consultant tender addenda",
        "Fit-out estimators pricing revised finishes and scope packages",
        "MEP subcontractors checking schedule and specification revisions",
        "Quantity surveyors recording the reviewed basis of a Dubai bid"
      ]
    },
    workflowProblem: {
      heading: "Separate the Tender Issue from the Approval Record",
      paragraphs: [
        <>
          Dubai Government opportunities may be managed through the official{" "}
          <a href="https://esupply.dubai.gov.ae/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            eSupply procurement portal
          </a>
          , while Dubai Municipality publishes separate{" "}
          <a href="https://www.dm.gov.ae/municipality-business/building-permit-steps/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            building-permit and completion procedures
          </a>
          . A tender BOQ, permit drawing, consultant addendum and pricing workbook can therefore carry different owners and issue status.
        </>,
        "Combining those records without a clear issue basis can cause teams to price an outdated schedule or mistake an authority document for the governing commercial scope. The responsible tender team must identify which document controls each decision."
      ]
    },
    quantaraSupport: {
      heading: "A Review Workspace, Not a Dubai Approval Portal",
      paragraphs: [
        "Quantara can retain supported project files in an authorized workspace, create review candidates from supported table rows in text-based PDFs, and keep confirmed BOQ revisions as distinct records.",
        "The bid and design teams must still interpret every addendum, reconcile the contractual scope and complete any eSupply or authority process separately. Quantara does not submit bids or permits, check authority requirements, issue approvals or decide which revision is contractually binding."
      ]
    },
    relevantFeatures: [
      { name: "Procurement and Permit Source Separation", capabilityId: "project-workspaces", description: "Keep supported tender, consultant and authority files together without presenting them as one approved record." },
      { name: "Addendum Review Candidates", capabilityId: "reviewed-extraction", description: "Confirm, correct or reject supported captured information before it is used in the BOQ." },
      { name: "Distinct BOQ Revision Records", capabilityId: "boq-management", description: "Organize reviewed sections and items by issue while professionals determine the applicable tender basis." }
    ],
    workflowExample: {
      heading: "Example: Dubai Tender Addendum Review",
      introduction: "A contractor receives a consultant BOQ, a later MEP addendum and separate permit drawings:",
      steps: [
        { title: "Record the Issue Basis", description: "Add the supported tender documents to the authorized project workspace and record the source issue used for review." },
        { title: "Import the Price Schedule", description: "Map the supported XLSX columns, validate the rows and approve only the records intended for the project BOQ." },
        { title: "Review the Addendum", description: "Capture supported table-row candidates from a text-based PDF and compare them manually with the consultant's revised scope." },
        { title: "Approve and Submit Separately", description: "A qualified professional signs off the reviewed BOQ output, then the responsible team completes the required procurement or authority submission outside Quantara." }
      ]
    },
    supportedInputs: [
      { name: "Employer or Consultant XLSX Schedule", capabilityId: "spreadsheet-import", description: "Map and validate supported trade, item, unit and quantity columns before approval." },
      { name: "Selectable-Text Tender Addendum", capabilityId: "text-pdf-extraction", description: "Store extractable text and create candidates only from supported detected table rows." },
      { name: "Scanned Drawing or Permit PDF", capabilityId: "scanned-pdf-detection", description: "Identify image-only pages so they can be routed for manual transcription and review." }
    ],
    supportedOutputs: [
      { name: "Reviewed BOQ Revision", capabilityId: "boq-management", description: "Retain the confirmed BOQ issue as a distinct project record." },
      { name: "Structured XLSX Issue Copy", capabilityId: "professional-outputs", description: "Export reviewed BOQ data for the professional team's controlled downstream use." },
      { name: "Template-Based PDF Output", capabilityId: "document-templates", description: "Apply a supported template to reviewed records; the result is not a permit or contractual approval." }
    ],
    limitations: [
      "Quantara does not connect to eSupply or Dubai Municipality systems and does not submit bids, permits, inspections or completion applications.",
      "The software does not determine which consultant, authority or contractual document governs a Dubai project.",
      "Quantara does not provide automatic drawing measurement, visual quantity takeoff or CAD/BIM model import.",
      "Image-only and scanned pages can be detected, but OCR text extraction is not currently available.",
      "Quantara does not provide Dubai market rates, calculate taxes or certify regulatory compliance; every output requires independent professional validation."
    ],
    faqs: [
      {
        question: "Does Quantara submit tenders through Dubai Government eSupply?",
        answer: <>
          No. eSupply is the official Dubai Government procurement portal; review its{" "}
          <a href="https://esupply.dubai.gov.ae/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">current supplier and tender process</a>
          . Quantara can organize supported BOQ records, but registration, bidding, clarification and award activity remain in the official process.
        </>,
        schemaAnswer: "No. Quantara does not connect to or submit tenders through Dubai Government eSupply. It can organize supported BOQ records, while registration, bidding, clarification and award activity remain in the official process."
      },
      {
        question: "Can Quantara obtain or validate a Dubai Municipality building permit?",
        answer: <>
          No. Dubai Municipality publishes its own{" "}
          <a href="https://www.dm.gov.ae/municipality-business/building-permit-steps/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">building-permit procedures</a>
          . Quantara neither submits an application nor checks, issues or certifies an authority approval.
        </>,
        schemaAnswer: "No. Quantara does not submit, check, issue or certify Dubai Municipality building permits or other authority approvals."
      },
      { question: "Can Quantara compare a consultant BOQ with a later addendum automatically?", answer: "Quantara can keep distinct revisions and create supported review candidates, but a qualified professional must identify every contractual change and decide how it affects scope, quantity and price." },
      { question: "Does Quantara measure Dubai fit-out or MEP drawings?", answer: "No. Quantara does not perform automatic visual takeoff or import CAD, BIM or IFC models. Professionals must establish and verify dimensions and quantities." },
      { question: "Does Quantara include Dubai rates, VAT or authority fees?", answer: "No. Quantara does not provide verified local market rates or calculate taxes, permit fees or statutory charges. The responsible commercial team must supply and review project-specific values." }
    ],
    relatedPages: [
      { href: "/boq-software", label: "BOQ Software", description: "Learn about structured BOQ management." },
      { href: "/boq-management", label: "BOQ Management", description: "Controlling project records and templates." },
      { href: "/ai-boq-software", label: "AI BOQ Software", description: "AI-assisted document extraction workflows." },
      { href: "/boq-software-uae", label: "BOQ Software UAE", description: "Review the wider UAE workflow and professional-responsibility boundaries." },
      { href: "/mep-estimating-software-uae", label: "MEP Estimating Software UAE", description: "Explore supported MEP schedule and BOQ organization without automatic takeoff." },
      { href: "/boq-revision-control", label: "BOQ Revision Control", description: "Use a practical process for issue status, change records and professional review." }
    ],
    showBuyerJourney: true
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-dubai" />;
}
