import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-abu-dhabi");



export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Abu Dhabi Consultants and Contractors",
    directDefinition: "Abu Dhabi infrastructure and facilities workflows can involve long-lived BOQ records shared between consultants and contractors. Quantara organizes supported sources and distinct BOQ revisions for professional review.",
    audience: {
      heading: "Designed for Professional Estimators",
      content: "Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.",
      items: ["Contractors managing complex tenders", "Consultants structuring master templates", "MEP and fit-out specialists"]
    },
    workflowProblem: {
      heading: "Contractor and Consultant Document Coordination",
      paragraphs: ["Engineering consultants and facilities-management teams in Abu Dhabi must maintain precise, long-term project records. Uncontrolled revisions in scattered files make it difficult to audit changes and coordinate updates between stakeholders.","Without a centralized system, maintaining an accurate baseline of the BOQ becomes administratively overwhelming."]
    },
    quantaraSupport: {
      heading: "Controlled Revisions and Project Records",
      paragraphs: ["Quantara retains BOQ revisions as distinct project records. Contractors and consultants must compare those records and document the commercial changes through their own review process.","Structured sections and item fields help organize the underlying data, while professional review remains required before any tender, contractual or construction use."]
    },
    relevantFeatures: [
      { name: "Hierarchical Structuring", status: "Available", description: "Organize reviewed items by trade or section." },
      { name: "BOQ Revision Records", status: "Available", description: "Keep distinct revision states for professional review." },
      { name: "Format Extraction", status: "Available", description: "Extract items from text-based PDFs and spreadsheets." }
    ],
    workflowExample: {
      heading: "Hypothetical Workflow Example",
      introduction: "How a team might manage a major revision during the tender phase:",
      steps: [
        { title: "Baseline Upload", description: "The original tender package is uploaded to an authorized project workspace." },
        { title: "Variation Arrival", description: "A revised specification is received via PDF." },
        { title: "Data Structuring", description: "Supported items are captured for review before they enter the BOQ record." },
        { title: "Professional Review", description: "The estimator applies commercial judgment to the varied quantities." }
      ]
    },
    supportedInputs: [
      { name: "XLSX / CSV", status: "Available", description: "Spreadsheet imports." },
      { name: "Text-based PDF", status: "Available", description: "Extraction from standard PDFs." },
      { name: "CAD / BIM", status: "Not available", description: "Model integration is not currently available.", limitation: "Capability to be confirmed." }
    ],
    supportedOutputs: [
      { name: "Structured XLSX", status: "Available", description: "Export reviewed BOQ data for further professional use." },
      { name: "PDF Outputs", status: "Available", description: "Generate reviewable documents from stored data and available templates." }
    ],
    limitations: [
      "Quantara does not provide automated visual measurement or drawing takeoff.",
      "The software does not certify costs, calculate taxes, or claim regional regulatory compliance.",
      "All outputs require independent professional validation."
    ],
    faqs: [
      { question: "Does Quantara calculate local taxes?", answer: "No, Quantara does not calculate taxes, statutory deductions, or provide local regulatory compliance checks." },
      { question: "Is this software approved by local authorities?", answer: "Quantara does not claim official government or authority approval. It is a commercial administrative tool." },
      { question: "Does it include a local rate database?", answer: "No, Quantara does not include a verified local rate database. Estimators must supply their own professionally reviewed pricing." },
      { question: "Can it replace professional judgment?", answer: "No. Quantara assists with supported capture and structured records, but a qualified professional must verify all commercial data." },
      { question: "Can it process scanned tender PDFs?", answer: "Quantara detects scanned or image-only PDF pages, but OCR text extraction is not currently available. Their content requires manual transcription and review." }
    ],
    relatedPages: [
      { href: "/boq-software", label: "BOQ Software", description: "Learn about structured BOQ management." },
      { href: "/boq-management", label: "BOQ Management", description: "Controlling project records and templates." },
      { href: "/ai-boq-software", label: "AI BOQ Software", description: "AI-assisted document extraction workflows." }
    ]
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-abu-dhabi" />;
}
