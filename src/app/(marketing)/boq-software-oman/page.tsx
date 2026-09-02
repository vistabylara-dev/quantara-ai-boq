import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-oman", locale);
}

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Oman BOQ Exchange",
    directDefinition: "Oman tender teams may exchange official procurement records, contractor price schedules, subcontract packages and local-content evidence through different workflows. Quantara organizes supported BOQ files and reviewed outputs, but it does not register a supplier, submit through the official eTendering system or assess local-content compliance.",
    audience: {
      heading: "For Oman Tender, Contractor and Subcontract Teams",
      content: "This workflow is for professionals who need controlled BOQ exchange between employer, consultant, main contractor and subcontractor while keeping official tendering and local-content decisions in their authorized systems.",
      items: [
        "Suppliers and contractors preparing price schedules for official tenders",
        "Main contractors aligning subcontract quotations with the tender BOQ",
        "Consultants issuing revised scope and clarification schedules",
        "Commercial teams checking local-content evidence outside the BOQ application"
      ]
    },
    workflowProblem: {
      heading: "Do Not Merge eTendering Status with the Reviewed BOQ",
      paragraphs: [
        <>
          Oman&apos;s official{" "}
          <a href="https://etendering.tenderboard.gov.om/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            eTendering portal
          </a>
          {" "}publishes tendering, company-registration and local-content resources. A portal record, mandatory-list requirement, consultant BOQ and subcontract quotation can each have a different reviewer and approval status.
        </>,
        "Contractor-consultant exchange often continues through spreadsheets and PDFs after clarifications are issued. Without a recorded source and revision basis, a subcontract quote may be checked against the wrong BOQ issue or treated as an approved contractual change."
      ]
    },
    quantaraSupport: {
      heading: "Controlled BOQ Exchange Outside Oman eTendering",
      paragraphs: [
        "Quantara can keep supported files inside a project workspace, map validated spreadsheet rows and generate supported outputs from reviewed BOQ records.",
        "The responsible Oman tender team must still complete supplier registration, obtain tender documents, interpret local-content and contract requirements, compare quotations and submit through the official system. Quantara does not perform or approve those steps."
      ]
    },
    relevantFeatures: [
      { name: "Tender and Subcontract Workspaces", capabilityId: "project-workspaces", description: "Keep supported employer, consultant and subcontract files within an authorized project workspace." },
      { name: "Quotation Schedule Mapping", capabilityId: "spreadsheet-import", description: "Map supported XLSX or CSV columns, validate rows and approve the intended import destination." },
      { name: "Reviewed Exchange Outputs", capabilityId: "professional-outputs", description: "Generate supported BOQ outputs from reviewed records for controlled professional use." }
    ],
    workflowExample: {
      heading: "Example: Oman Main-Contract and Subcontract BOQ Exchange",
      introduction: "A main contractor receives an official tender BOQ, collects trade quotations and later receives a consultant clarification:",
      steps: [
        { title: "Obtain the Official Package", description: "The authorized team completes registration and tender-document access through the applicable external process." },
        { title: "Map the Tender BOQ", description: "Import the supported spreadsheet, validate its sections and rows, and approve the intended project records." },
        { title: "Review Quotations and Clarification", description: "Keep subcontract offers and the consultant clarification distinguishable while professionals reconcile coverage, exclusions and revision effects." },
        { title: "Export and Submit Separately", description: "Generate a reviewed BOQ output, then complete local-content checks and official tender submission outside Quantara." }
      ]
    },
    supportedInputs: [
      { name: "Tender or Subcontract XLSX/CSV", capabilityId: "spreadsheet-import", description: "Map supported item, unit, quantity and price-schedule columns with validation before approval." },
      { name: "Text-Based Clarification PDF", capabilityId: "text-pdf-extraction", description: "Create candidates only from supported detected table rows and check them against the original." },
      { name: "Scanned Tender Attachment", capabilityId: "scanned-pdf-detection", description: "Detect an image-only page so the team knows manual transcription is required." }
    ],
    supportedOutputs: [
      { name: "Reviewed BOQ Exchange Workbook", capabilityId: "professional-outputs", description: "Export reviewed structured data for controlled contractor-consultant exchange." },
      { name: "Distinct Tender Revision", capabilityId: "boq-management", description: "Keep the confirmed BOQ issue separate from quotations, clarifications and prior revisions." },
      { name: "Template-Based PDF Document", capabilityId: "document-templates", description: "Generate a supported document from reviewed records without implying official acceptance or award." }
    ],
    limitations: [
      "Quantara does not integrate with Oman's official eTendering system, register companies, obtain tender documents or submit bids.",
      "The software does not assess mandatory-list, local-content, classification, award or contractual requirements.",
      "Quantara does not compare subcontract coverage automatically or decide whether a quotation satisfies the tender scope.",
      "Automatic drawing takeoff, CAD/BIM/IFC import and OCR extraction from scanned pages are not available.",
      "Quantara does not provide Oman market rates or calculate taxes, fees or statutory deductions; every output requires independent professional review."
    ],
    faqs: [
      {
        question: "Does Quantara submit tenders through Oman's official eTendering system?",
        answer: <>
          No. Company registration, tender access and submission remain in the official{" "}
          <a href="https://etendering.tenderboard.gov.om/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">Oman eTendering process</a>
          . Quantara has no verified integration with that system.
        </>,
        schemaAnswer: "No. Quantara has no verified integration with Oman's official eTendering system and does not register companies, obtain tender documents or submit bids."
      },
      {
        question: "Does Quantara verify Oman local-content or mandatory-list requirements?",
        answer: <>
          No. The responsible bidder must use the current tender documents and official{" "}
          <a href="https://etendering.tenderboard.gov.om/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">eTendering and local-content resources</a>
          . Quantara does not calculate, assess or certify compliance.
        </>,
        schemaAnswer: "No. Quantara does not calculate, assess or certify Oman local-content or mandatory-list compliance. The responsible bidder must use the current tender documents and official resources."
      },
      { question: "Can Quantara reconcile subcontract quotations with the tender BOQ automatically?", answer: "No. Quantara can organize supported schedules and revisions, but the commercial team must compare coverage, qualifications, exclusions, rates and contractual scope." },
      { question: "Can Quantara keep a consultant clarification separate from the original BOQ?", answer: "Yes, supported sources and BOQ revisions can be kept as distinct records. A qualified professional must determine every change and approve the applicable issue." },
      { question: "Does Quantara include Oman rates, tax or tender fees?", answer: "No. Quantara does not provide verified local market rates or calculate taxes, tender fees or statutory deductions. Project-specific values require authorized professional review." }
    ],
    relatedPages: [
      { href: "/gcc-boq-software", label: "GCC BOQ Software", description: "Review the common GCC workflow boundaries without local compliance claims." },
      { href: "/boq-software-vs-spreadsheets", label: "BOQ Software vs Spreadsheets", description: "Compare structured records with manual spreadsheet exchange and revision control." },
      { href: "/boq-document-generation", label: "BOQ Document Generation", description: "Understand supported outputs from reviewed project data and templates." }
    ]
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-oman" />;
}
