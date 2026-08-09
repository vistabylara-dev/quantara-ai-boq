import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-qatar");



export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Qatar Tender Revisions",
    directDefinition: "Qatar tender workflows can include consultant-issued BOQs and multidisciplinary MEP schedules. Quantara organizes supported information and distinct BOQ revision records for professional review.",
    audience: {
      heading: "Designed for Professional Estimators",
      content: "Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.",
      items: ["Contractors managing complex tenders", "Consultants structuring master templates", "MEP and fit-out specialists"]
    },
    workflowProblem: {
      heading: "Consultant-Issued BOQ Management",
      paragraphs: ["When contractors receive consultant-issued BOQs, including multidisciplinary MEP packages, they need a reliable process for structuring information for pricing. Frequent tender revisions can become difficult to reconcile when records are spread across separate files.","A structured review process can separate document preparation from the professional commercial judgement applied by estimators."]
    },
    quantaraSupport: {
      heading: "Structured Records for Professional Review",
      paragraphs: ["Quantara captures supported information from text-based MEP schedules and consultant BOQs into a structured review workflow. Tender revisions are retained as distinct records.","The responsible professional must compare those records, verify the captured information and determine which scope is ready for commercial review."]
    },
    relevantFeatures: [
      { name: "Hierarchical Structuring", capabilityId: "boq-management", description: "Organize reviewed items by trade or section." },
      { name: "BOQ Revision Records", capabilityId: "boq-management", description: "Keep distinct revision states for professional review." },
      { name: "Format Extraction", capabilityId: "text-pdf-extraction", description: "Store extractable PDF text and create review candidates from supported detected table rows." }
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
      { name: "XLSX / CSV", capabilityId: "spreadsheet-import", description: "Spreadsheet imports." },
      { name: "Text-based PDF", capabilityId: "text-pdf-extraction", description: "Supported extraction from text-based PDFs." },
      { name: "CAD / BIM", capabilityId: "model-file-import", description: "Model integration is not currently available." }
    ],
    supportedOutputs: [
      { name: "Structured XLSX", capabilityId: "professional-outputs", description: "Export reviewed BOQ data for further professional use." },
      { name: "PDF Outputs", capabilityId: "professional-outputs", description: "Generate reviewable documents from stored data and available templates." }
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

  return <SeoLandingPage content={content} currentPath="/boq-software-qatar" />;
}
