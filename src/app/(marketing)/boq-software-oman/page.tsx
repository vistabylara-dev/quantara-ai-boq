import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Oman Construction Exchange",
  description: "Facilitate contractor and consultant BOQ exchange, manage project revisions, and generate controlled outputs for projects in Oman.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-oman",
  },
  openGraph: {
    title: "BOQ Software for Oman Construction Exchange | Quantara",
    description: "Facilitate contractor and consultant BOQ exchange, manage project revisions, and generate controlled outputs for projects in Oman.",
    url: "https://quantara.vistabylara.com/boq-software-oman",
    type: "article",
  },
};

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Oman BOQ Exchange",
    directDefinition: "Exchanging BOQs between contractors and consultants in Oman requires clear tracking of PDF and spreadsheet workflows. Quantara organizes this data and ensures controlled outputs.",
    audience: {
      heading: "Designed for Professional Estimators",
      content: "Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.",
      items: ["Contractors managing complex tenders", "Consultants structuring master templates", "MEP and fit-out specialists"]
    },
    workflowProblem: {
      heading: "Contractor and Consultant BOQ Exchange",
      paragraphs: ["Standard PDF and spreadsheet workflows in Oman involve constant data exchange between contractors and consultants. When project revisions are handled manually, version control breaks down and outputs become disjointed.","This manual exchange process creates administrative bottlenecks that delay tender submissions and commercial reviews."]
    },
    quantaraSupport: {
      heading: "Project Revisions and Controlled Outputs",
      paragraphs: ["Quantara secures the contractor and consultant BOQ exchange by enforcing strict project revisions in a structured workspace. Every change is tracked, ensuring that all teams refer to a single, governed source.","The software then generates controlled outputs for proposal preparation, relying completely on professional validation before any document is finalized."]
    },
    relevantFeatures: [
      { name: "Hierarchical Structuring", status: "Live", description: "Organize items safely by trade or section." },
      { name: "Revision Tracking", status: "Preview UI", description: "Maintain a distinct commercial audit trail." },
      { name: "Format Extraction", status: "Live", description: "Extract items from text-based PDFs and spreadsheets." }
    ],
    workflowExample: {
      heading: "Hypothetical Workflow Example",
      introduction: "How a team might manage a major revision during the tender phase:",
      steps: [
        { title: "Baseline Upload", description: "The original tender package is securely imported." },
        { title: "Variation Arrival", description: "A revised specification is received via PDF." },
        { title: "Data Structuring", description: "New items are mapped into the controlled BOQ format." },
        { title: "Professional Review", description: "The estimator applies commercial judgment to the varied quantities." }
      ]
    },
    supportedInputs: [
      { name: "XLSX / CSV", status: "Live", description: "Spreadsheet imports." },
      { name: "Text-based PDF", status: "Live", description: "Extraction from standard PDFs." },
      { name: "CAD / BIM", status: "Planned", description: "Future model integration.", limitation: "Capability to be confirmed." }
    ],
    supportedOutputs: [
      { name: "Structured XLSX", status: "Live", description: "Export governed data." },
      { name: "PDF Proposals", status: "Live", description: "Generate standardized documents." }
    ],
    limitations: [
      "Quantara does not provide automated visual measurement or drawing takeoff.",
      "The software does not certify costs, calculate taxes, or claim regional regulatory compliance.",
      "All outputs strictly require independent professional validation."
    ],
    faqs: [
      { question: "Does Quantara calculate local taxes?", answer: "No, Quantara does not calculate taxes, statutory deductions, or provide local regulatory compliance checks." },
      { question: "Is this software approved by local authorities?", answer: "Quantara does not claim official government or authority approval. It is a commercial administrative tool." },
      { question: "Does it include a local rate database?", answer: "No, Quantara does not include a verified local rate database. Estimators must supply their own professionally reviewed pricing." },
      { question: "Can it replace professional judgment?", answer: "Absolutely not. Quantara handles data extraction and structuring, but a qualified professional must verify all commercial data." }
    ],
    relatedPages: [
      { href: "/boq-software", label: "BOQ Software", description: "Learn about structured BOQ management." },
      { href: "/boq-management", label: "BOQ Management", description: "Controlling project records and templates." },
      { href: "/ai-boq-software", label: "AI BOQ Software", description: "AI-assisted document extraction workflows." }
    ]
  };

  return (
    <>
      <SeoLandingPage content={content} currentPath="/boq-software-oman" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-software-oman#webpage",
                "url": "https://quantara.vistabylara.com/boq-software-oman",
                "name": "BOQ Software for Oman Construction Exchange | Quantara",
                "description": "Facilitate contractor and consultant BOQ exchange, manage project revisions, and generate controlled outputs for projects in Oman.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-software-oman#breadcrumb",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quantara.vistabylara.com/" },
                  { "@type": "ListItem", "position": 2, "name": "Regional BOQ Software" }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-software-oman#faq",
                "mainEntity": content.faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
                }))
              }
            ]
          })
        }}
      />
    </>
  );
}
