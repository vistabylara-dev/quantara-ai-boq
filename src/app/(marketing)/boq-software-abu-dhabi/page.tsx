import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-software-abu-dhabi");

export default function Page() {
  const content: SeoLandingPageContent = {
    breadcrumbLabel: "BOQ Software",
    h1: "BOQ Software for Abu Dhabi Consultants and Contractors",
    directDefinition: "Abu Dhabi procurement teams may need to coordinate supplier-registration records, consultant-issued BOQs, clarification responses and long-lived project revisions. Quantara organizes supported commercial records for review, but it does not qualify suppliers, submit government bids or approve contractual scope.",
    audience: {
      heading: "For Abu Dhabi Procurement and Project-Control Teams",
      content: "This page addresses teams that need a traceable BOQ review process alongside, but separate from, government procurement, consultant approval and facilities handover procedures.",
      items: [
        "Registered suppliers preparing responses for participating government entities",
        "Consultants issuing coordinated BOQ and clarification packages",
        "Infrastructure contractors managing discipline and package revisions",
        "Facilities teams reviewing refurbishment BOQs without replacing an asset-management system"
      ]
    },
    workflowProblem: {
      heading: "Supplier Qualification and BOQ Review Are Different Records",
      paragraphs: [
        <>
          The official{" "}
          <a href="https://www.adgpg.gov.ae/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">
            Abu Dhabi Government Procurement Gate
          </a>
          {" "}manages the supplier journey for participating government entities. Its published guidance explains that supplier registration and qualification do not themselves guarantee tender shortlisting.
        </>,
        "A project team must therefore keep supplier eligibility, tender instructions, clarification responses, consultant BOQ issues and priced revisions distinguishable. A structured BOQ record can support review, but it cannot determine whether a bidder is eligible or a submission is compliant."
      ]
    },
    quantaraSupport: {
      heading: "Traceable Project Records Outside the Procurement Gate",
      paragraphs: [
        "Quantara can associate supported project workspaces with client records, retain available source references and organize confirmed BOQ revisions by section and item.",
        "Procurement officers, consultants and contractors must still complete registration, evaluate tender instructions, answer clarifications and approve commercial changes through their authorized processes. Quantara does not integrate with the Procurement Gate or convert a review record into government, consultant or contractual approval."
      ]
    },
    relevantFeatures: [
      { name: "Client-Linked Project Workspaces", capabilityId: "client-records", description: "Associate supported project workspaces with searchable company-scoped client records without presenting Quantara as a CRM." },
      { name: "Available Source References", capabilityId: "source-attribution", description: "Keep source identity and available evidence references with supported records for professional checking." },
      { name: "Discipline and Package Revisions", capabilityId: "boq-management", description: "Organize sections, items and distinct revisions while the project team resolves the governing scope." }
    ],
    workflowExample: {
      heading: "Example: Consultant Clarification and Revised BOQ",
      introduction: "An infrastructure bidder receives a consultant BOQ followed by a clarification response that changes selected package information:",
      steps: [
        { title: "Register the Tender Basis", description: "Keep the supported procurement notice, consultant issue and internal review files in the authorized project workspace." },
        { title: "Map the Consultant Schedule", description: "Import supported spreadsheet columns, validate the records and approve only the intended BOQ destination." },
        { title: "Record the Clarification Issue", description: "Retain the later source as a separate record and have the responsible professional identify each commercial effect." },
        { title: "Issue a Checked Package", description: "Generate a supported output from the reviewed revision, then complete bid submission and consultant approval outside Quantara." }
      ]
    },
    supportedInputs: [
      { name: "Consultant-Issued XLSX or CSV", capabilityId: "spreadsheet-import", description: "Map supported package and item fields with validation before import approval." },
      { name: "Text-Based Scope or Clarification PDF", capabilityId: "text-pdf-extraction", description: "Create candidates only from supported detected table rows and compare them with the original document." },
      { name: "Authorized Google Drive File", capabilityId: "google-drive-import", description: "Import a selected supported file only where a controlled-access workspace connection is authorized." }
    ],
    supportedOutputs: [
      { name: "Package-Level BOQ Revision", capabilityId: "boq-management", description: "Keep the reviewed package issue distinct from earlier tender and clarification records." },
      { name: "Professional BOQ Output", capabilityId: "professional-outputs", description: "Generate a supported project output from reviewed data for further checking and authorized use." },
      { name: "Private Client Review Record", capabilityId: "client-proposals", description: "Where enabled, record comments or a review response; this is not an electronic signature or contractual approval." }
    ],
    limitations: [
      "Quantara does not register or qualify suppliers, monitor opportunities or submit responses through the Abu Dhabi Government Procurement Gate.",
      "Supplier registration, shortlisting, tender compliance and award decisions remain with the applicable official and project processes.",
      "Quantara is not a facilities-management, asset-register, digital-twin or consultant-approval platform.",
      "The software does not validate Abu Dhabi authority requirements, specifications, designs or contractual entitlement.",
      "Automatic drawing takeoff and OCR extraction are not available; local rates, taxes and every output require independent professional review."
    ],
    faqs: [
      {
        question: "Does Quantara connect to the Abu Dhabi Government Procurement Gate?",
        answer: <>
          No. Supplier registration, opportunities and tender activity remain on the official{" "}
          <a href="https://www.adgpg.gov.ae/" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">Abu Dhabi Government Procurement Gate</a>
          . Quantara has no verified integration with that portal.
        </>,
        schemaAnswer: "No. Quantara has no verified integration with the Abu Dhabi Government Procurement Gate. Supplier registration, opportunities and tender activity remain on the official portal."
      },
      {
        question: "Does supplier registration mean a Quantara BOQ is eligible for an Abu Dhabi government tender?",
        answer: <>
          No. The official{" "}
          <a href="https://adgpg.gov.ae/en/Trading-With-Government/Becoming-a-Registered-Supplier" target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline dark:text-blue-400">supplier-registration guidance</a>
          {" "}states that qualification during registration is not tender shortlisting and does not guarantee business. Quantara cannot determine eligibility or compliance.
        </>,
        schemaAnswer: "No. Quantara cannot determine supplier eligibility, tender shortlisting or compliance. The applicable government entity and official procurement process control those decisions."
      },
      { question: "Can Quantara preserve consultant clarifications and revised BOQs?", answer: "It can retain supported sources and distinct BOQ revisions, but the responsible consultant and commercial team must interpret each clarification and approve any resulting change." },
      { question: "Can Quantara act as an Abu Dhabi facilities asset register?", answer: "No. Quantara can organize supported maintenance or refurbishment BOQs, but it is not represented as a CMMS, digital twin or full asset-management platform." },
      { question: "Does Quantara approve local specifications, rates or authority requirements?", answer: "No. Quantara does not provide authority approval, a verified local rate database or regulatory validation. Qualified professionals must check all project-specific requirements and values." }
    ],
    relatedPages: [
      { href: "/boq-software-uae", label: "BOQ Software UAE", description: "Review supported UAE BOQ workflows and their professional boundaries." },
      { href: "/boq-software-for-facilities-management", label: "Facilities Management BOQs", description: "See where Quantara can support refurbishment records without acting as a CMMS." },
      { href: "/boq-software-for-engineering-consultants", label: "BOQ Software for Consultants", description: "Explore consultant schedules, revisions and independent professional review." }
    ]
  };

  return <SeoLandingPage content={content} currentPath="/boq-software-abu-dhabi" />;
}
