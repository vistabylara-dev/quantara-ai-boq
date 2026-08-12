import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-management");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "BOQ Management",
  h1: "BOQ Management for Controlled Project Records and Revisions",
  directDefinition: "BOQ management is the structured administration of sections, items, quantities, rates, revision records and outputs. Controls can support consistency, but professional review and company procedures remain essential.",
  audience: {
    heading: "Who Needs Strict BOQ Management?",
    content: "Defined records and review responsibilities help teams manage complex or long-term construction projects.",
    items: ["Commercial Directors ensuring standardization","Project Managers tracking scope changes","Quantity Surveyors maintaining revision records","Estimating Departments managing central templates"]
  },
  workflowProblem: {
    heading: "The Chaos of Unmanaged Data",
    paragraphs: [
      <>When BOQs are managed as loose files on local hard drives or shared folders, governance breaks down. Different estimators use different formatting, revisions overwrite original files, and tracking the history of a specific item&apos;s quantity becomes impossible. This is particularly challenging when compared to <Link href="/boq-software-vs-document-management" className="text-blue-600 hover:underline font-medium">generic document management</Link>.</>,
      "This lack of centralization leads to inconsistent client proposals, lost data during staff turnover, and significant difficulty in auditing project history during commercial disputes."
    ]
  },
  quantaraSupport: {
    heading: "Centralized Control and Governance",
    paragraphs: ["Quantara organizes authorized project files and BOQ records within company and project workspaces. BOQ revisions are retained as distinct records rather than relying only on renamed files.","Available templates and structured fields can support consistent records. Users must still control access, compare revisions and verify the history required by their own procedures."]
  },
  relevantFeatures: [{"name":"Project and Client Workspaces","capabilityId":"project-workspaces","description":"Organize authorized records by client and project."},{"name":"Available Templates","capabilityId":"document-templates","description":"Apply supported section and item formatting where configured."},{"name":"BOQ Revision Records","capabilityId":"boq-management","description":"Keep distinct BOQ revisions and status records for professional review."}],
  workflowExample: {
    heading: "Managing a Major Revision",
    introduction: "How a team handles a major design change mid-tender:",
    steps: [{"title":"Retain Original","description":"The reviewed BOQ is retained as a distinct revision record."},{"title":"Review Addendum","description":"Supported information from revised text-based sources is captured for professional review."},{"title":"Update Structure","description":"Confirmed items and quantities are entered into the new BOQ revision."},{"title":"Compare and Review","description":"The professional team compares the records and interprets the scope differences."},{"title":"Generate Update","description":"A supported output is generated from stored data and checked before issue; generation does not enforce review completion."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","capabilityId":"spreadsheet-import","description":"Supported structured spreadsheet formats, subject to mapping and review."},{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Capture supported information for professional review."},{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for scanned records is not currently implemented.","limitation":"Scanned records require manual transcription."},{"name":"CAD / BIM","capabilityId":"model-file-import","description":"Model-based extraction is not currently available."}],
  supportedOutputs: [{"name":"Structured Project Records","capabilityId":"project-workspaces","description":"Authorized company and project workspaces for supported records."},{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured data export for further professional use."},{"name":"PDF Generation","capabilityId":"professional-outputs","description":"Reviewable documents generated from stored data and available templates."}],
  limitations: ["Quantara requires users to adhere to its hierarchical structure; it is not a free-form canvas.","Governance relies on proper user management and internal company procedures.","Final commercial responsibility always remains with the human professional."],
  faqs: [{"question":"What is BOQ management?","answer":"It is the structured organization of BOQ sections, items, quantities, rates, revision records and outputs within a defined workflow."},{"question":"Why are BOQ revisions important?","answer":"Distinct revisions preserve historical states for comparison. Users still need to document and interpret what changed and why."},{"question":"How should BOQ sections be structured?","answer":"They should follow a logical hierarchy, such as trades, sub-trades and items, aligned with the project method or an available company template."},{"question":"Can BOQ items be grouped?","answer":"Yes. Supported BOQ items can be grouped into sections and subsections."},{"question":"How are project records organized?","answer":"Quantara keeps supported files and BOQ records within authorized company and project workspaces."},{"question":"What is template governance?","answer":"It is the controlled use of available layouts, section names and formatting rules. Configuration and every resulting document still require review."},{"question":"Can previous revisions be reviewed?","answer":"Yes. Distinct BOQ revision records can be opened for professional comparison, but Quantara does not claim a complete automated line-by-line change analysis."},{"question":"Who is responsible for final approval?","answer":"A qualified professional must review and approve managed data before contractual, tender, procurement or construction use."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"The core technology behind structured BOQs."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying managed data to commercial estimates."},{"href":"/boq-document-generation","label":"Document Generation","description":"Generating reviewable outputs from stored data."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Software tools for QS professionals."},{"href":"/features","label":"Product Features","description":"View all Quantara management capabilities."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/boq-management" />;
}
