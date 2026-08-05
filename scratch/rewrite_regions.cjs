const fs = require('fs');
const path = require('path');

const regions = [
  {
    path: 'boq-software-dubai',
    title: 'BOQ Software for Dubai Projects | Quantara',
    desc: 'Support fit-out, MEP coordination, and frequent tender revisions with structured BOQ software designed for Dubai construction workflows.',
    h1: 'BOQ Software for Dubai Construction Workflows',
    summary: 'Dubai construction projects—especially fast-paced fit-outs and complex MEP installations—require careful coordination of revisions and document exchanges. Quantara provides a structured database environment to manage these workflows safely.',
    challengeHeading: 'Managing Frequent Tender Revisions',
    challengeParas: [
      'Fit-out projects and MEP coordination in Dubai often involve rapid design changes and frequent tender revisions. Managing these updates via loose PDF and Excel document exchanges can lead to lost data and commercial risk.',
      'A structured approach is required to ensure that every proposal preparation uses the correct version of the project records.'
    ],
    supportHeading: 'Structured Document Exchange',
    supportParas: [
      'Quantara helps teams organize PDF and Excel inputs into a controlled, hierarchical BOQ. By maintaining strict revision control, estimators and coordinators can track exactly what changed between tender versions.',
      'This reduces the administrative burden of proposal preparation, allowing professionals to focus on commercial analysis rather than reformatting spreadsheets.'
    ]
  },
  {
    path: 'boq-software-abu-dhabi',
    title: 'BOQ Software for Abu Dhabi Engineering | Quantara',
    desc: 'Organize project records, manage controlled revisions, and coordinate documents between contractors and engineering consultants in Abu Dhabi.',
    h1: 'BOQ Software for Abu Dhabi Consultants and Contractors',
    summary: 'Large-scale infrastructure and facilities-management work in Abu Dhabi demands strict document coordination between engineering consultants and contractors. Quantara structures these records into a secure, searchable format.',
    challengeHeading: 'Contractor and Consultant Document Coordination',
    challengeParas: [
      'Engineering consultants and facilities-management teams in Abu Dhabi must maintain precise, long-term project records. Uncontrolled revisions in scattered files make it difficult to audit changes and coordinate updates between stakeholders.',
      'Without a centralized system, maintaining an accurate baseline of the BOQ becomes administratively overwhelming.'
    ],
    supportHeading: 'Controlled Revisions and Project Records',
    supportParas: [
      'Quantara enforces controlled revisions, meaning every commercial change is recorded as a distinct snapshot. This helps contractors and consultants coordinate documents safely.',
      'By organizing project records in a structured database, teams ensure that the underlying commercial data remains governed and professionally reviewed.'
    ]
  },
  {
    path: 'boq-software-saudi-arabia',
    title: 'BOQ Software for Saudi Arabia Projects | Quantara',
    desc: 'Manage large multidisciplinary document packages and revision-heavy project records for complex construction in Saudi Arabia.',
    h1: 'BOQ Software for Saudi Arabia Project Records',
    summary: 'Massive multidisciplinary document packages in Saudi Arabia require robust systems for contractor and consultant coordination. Quantara handles revision-heavy workflows securely.',
    challengeHeading: 'Multidisciplinary Document Packages',
    challengeParas: [
      'Complex projects in Saudi Arabia often involve massive, multidisciplinary BOQ packages spanning thousands of items. Tracking revisions across PDF and spreadsheet workflows is prone to manual errors that create immense commercial risk.',
      'Contractor and consultant coordination becomes stalled when teams are forced to manually compare loose document versions line-by-line.'
    ],
    supportHeading: 'Revision-Heavy Project Control',
    supportParas: [
      'Quantara is built for revision-heavy project records. It provides the structured workspaces required to organize large multidisciplinary packages safely.',
      'By supporting standard PDF and spreadsheet workflows, Quantara allows teams to import data efficiently while ensuring all outputs undergo strict professional review.'
    ]
  },
  {
    path: 'boq-software-qatar',
    title: 'BOQ Software for Qatar MEP and Consultant Workflows | Quantara',
    desc: 'Organize consultant-issued BOQs, manage MEP packages, and track tender revisions with structured software for Qatar projects.',
    h1: 'BOQ Software for Qatar Tender Revisions',
    summary: 'Qatar construction projects rely heavily on consultant-issued BOQs and complex MEP packages. Quantara provides the structured records required for rigorous professional review and revision tracking.',
    challengeHeading: 'Consultant-Issued BOQ Management',
    challengeParas: [
      'When contractors receive consultant-issued BOQs, especially large MEP packages, they must quickly structure the data for pricing. Managing frequent tender revisions without a dedicated system leads to lost tracking and pricing errors.',
      'Estimators waste valuable time reformatting consultant documents rather than applying professional commercial judgment.'
    ],
    supportHeading: 'Structured Records for Professional Review',
    supportParas: [
      'Quantara structures these complex MEP packages and consultant-issued BOQs into a secure database. Tender revisions are tracked distinctly, maintaining a clear audit trail of the project scope.',
      'This structured approach ensures that the human professional always has accurate, organized data ready for commercial review.'
    ]
  },
  {
    path: 'boq-software-oman',
    title: 'BOQ Software for Oman Construction Exchange | Quantara',
    desc: 'Facilitate contractor and consultant BOQ exchange, manage project revisions, and generate controlled outputs for projects in Oman.',
    h1: 'BOQ Software for Oman BOQ Exchange',
    summary: 'Exchanging BOQs between contractors and consultants in Oman requires clear tracking of PDF and spreadsheet workflows. Quantara organizes this data and ensures controlled outputs.',
    challengeHeading: 'Contractor and Consultant BOQ Exchange',
    challengeParas: [
      'Standard PDF and spreadsheet workflows in Oman involve constant data exchange between contractors and consultants. When project revisions are handled manually, version control breaks down and outputs become disjointed.',
      'This manual exchange process creates administrative bottlenecks that delay tender submissions and commercial reviews.'
    ],
    supportHeading: 'Project Revisions and Controlled Outputs',
    supportParas: [
      'Quantara secures the contractor and consultant BOQ exchange by enforcing strict project revisions in a structured workspace. Every change is tracked, ensuring that all teams refer to a single, governed source.',
      'The software then generates controlled outputs for proposal preparation, relying completely on professional validation before any document is finalized.'
    ]
  }
];

const basePath = path.join(process.cwd(), 'src', 'app');

regions.forEach(region => {
  const pagePath = path.join(basePath, region.path, 'page.tsx');
  
  const content = `import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "${region.title}",
  description: "${region.desc}",
  alternates: {
    canonical: "https://quantara.vistabylara.com/${region.path}",
  },
  openGraph: {
    title: "${region.title}",
    description: "${region.desc}",
    url: "https://quantara.vistabylara.com/${region.path}",
    type: "article",
  },
};

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "${region.h1}",
    directDefinition: "${region.summary}",
    audience: {
      heading: "Designed for Professional Estimators",
      content: "Quantara supports professionals who require structured data management for complex projects. All extracted quantities and generated proposals must be reviewed by a qualified human professional.",
      items: ["Contractors managing complex tenders", "Consultants structuring master templates", "MEP and fit-out specialists"]
    },
    workflowProblem: {
      heading: "${region.challengeHeading}",
      paragraphs: ${JSON.stringify(region.challengeParas)}
    },
    quantaraSupport: {
      heading: "${region.supportHeading}",
      paragraphs: ${JSON.stringify(region.supportParas)}
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
      <SeoLandingPage content={content} currentPath="/${region.path}" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/${region.path}#webpage",
                "url": "https://quantara.vistabylara.com/${region.path}",
                "name": "${region.title}",
                "description": "${region.desc}",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/${region.path}#breadcrumb",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://quantara.vistabylara.com/" },
                  { "@type": "ListItem", "position": 2, "name": "Regional BOQ Software" }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/${region.path}#faq",
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
`;

  fs.writeFileSync(pagePath, content);
  console.log('Wrote ' + pagePath);
});
