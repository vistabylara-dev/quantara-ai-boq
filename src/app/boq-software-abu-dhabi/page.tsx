import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Abu Dhabi Engineering | Quantara",
  description: "Organize project records, manage controlled revisions, and coordinate documents between contractors and engineering consultants in Abu Dhabi.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-abu-dhabi",
  },
  openGraph: {
    title: "BOQ Software for Abu Dhabi Engineering | Quantara",
    description: "Organize project records, manage controlled revisions, and coordinate documents between contractors and engineering consultants in Abu Dhabi.",
    url: "https://quantara.vistabylara.com/boq-software-abu-dhabi",
    type: "article",
  },
};

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Abu Dhabi Consultants and Contractors",
    directDefinition: "Large-scale infrastructure and facilities-management work in Abu Dhabi demands strict document coordination between engineering consultants and contractors. Quantara structures these records into a secure, searchable format.",
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
      paragraphs: ["Quantara enforces controlled revisions, meaning every commercial change is recorded as a distinct snapshot. This helps contractors and consultants coordinate documents safely.","By organizing project records in a structured database, teams ensure that the underlying commercial data remains governed and professionally reviewed."]
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
      <SeoLandingPage content={content} currentPath="/boq-software-abu-dhabi" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-software-abu-dhabi#webpage",
                "url": "https://quantara.vistabylara.com/boq-software-abu-dhabi",
                "name": "BOQ Software for Abu Dhabi Engineering | Quantara",
                "description": "Organize project records, manage controlled revisions, and coordinate documents between contractors and engineering consultants in Abu Dhabi.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-software-abu-dhabi#breadcrumb",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quantara.vistabylara.com/" },
                  { "@type": "ListItem", "position": 2, "name": "Regional BOQ Software" }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-software-abu-dhabi#faq",
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
