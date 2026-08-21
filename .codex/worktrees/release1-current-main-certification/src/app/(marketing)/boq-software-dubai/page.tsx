import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Software for Dubai Projects",
  description: "Support fit-out, MEP coordination, and frequent tender revisions with structured BOQ software designed for Dubai construction workflows.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-software-dubai",
  },
  openGraph: {
    title: "BOQ Software for Dubai Projects | Quantara",
    description: "Support fit-out, MEP coordination, and frequent tender revisions with structured BOQ software designed for Dubai construction workflows.",
    url: "https://quantara.vistabylara.com/boq-software-dubai",
    type: "article",
  },
};

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Dubai Construction Workflows",
    directDefinition: "Dubai construction projects—especially fast-paced fit-outs and complex MEP installations—require careful coordination of revisions and document exchanges. Quantara provides a structured database environment to manage these workflows safely.",
    audience: {
      heading: "Designed for Professional Estimators",
      content: "Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.",
      items: ["Contractors managing complex tenders", "Consultants structuring master templates", "MEP and fit-out specialists"]
    },
    workflowProblem: {
      heading: "Managing Frequent Tender Revisions",
      paragraphs: ["Fit-out projects and MEP coordination in Dubai often involve rapid design changes and frequent tender revisions. Managing these updates via loose PDF and Excel document exchanges can lead to lost data and commercial risk.","A structured approach is required to ensure that every proposal preparation uses the correct version of the project records."]
    },
    quantaraSupport: {
      heading: "Structured Document Exchange",
      paragraphs: ["Quantara helps teams organize PDF and Excel inputs into a controlled, hierarchical BOQ. By maintaining strict revision control, estimators and coordinators can track exactly what changed between tender versions.","This reduces the administrative burden of proposal preparation, allowing professionals to focus on commercial analysis rather than reformatting spreadsheets."]
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
      <SeoLandingPage content={content} currentPath="/boq-software-dubai" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-software-dubai#webpage",
                "url": "https://quantara.vistabylara.com/boq-software-dubai",
                "name": "BOQ Software for Dubai Projects | Quantara",
                "description": "Support fit-out, MEP coordination, and frequent tender revisions with structured BOQ software designed for Dubai construction workflows.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-software-dubai#breadcrumb",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quantara.vistabylara.com/" },
                  { "@type": "ListItem", "position": 2, "name": "Regional BOQ Software" }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-software-dubai#faq",
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
