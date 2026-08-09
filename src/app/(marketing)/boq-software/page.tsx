import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata = createPublicPageMetadata("/boq-software");



const content: SeoLandingPageContent = {
  breadcrumbLabel: "BOQ Software",
  h1: "BOQ Software for Controlled Construction and Estimating Workflows",
  directDefinition: "BOQ software provides a structured environment for Bills of Quantities, with controlled project records, revision handling and templates alongside supported spreadsheet import and export workflows.",
  audience: {
    heading: "Who Relies on BOQ Software?",
    content: "BOQ software can help teams manage complex project scopes and commercial data in a structured workspace.",
    items: ["Commercial Managers overseeing project budgets","Estimators requiring stable calculation environments","Quantity Surveyors tracking variations","Contractors standardizing their bidding process"]
  },
  workflowProblem: {
    heading: "The Limitations of Spreadsheets",
    paragraphs: ["Spreadsheets offer flexible formulas and formatting, while structure, access and revision visibility depend on workbook design and team controls.","For large multi-trade BOQs, teams may need a system that stores defined relationships between sections, items, quantities and rates. Professional review remains necessary whichever workflow is used."]
  },
  quantaraSupport: {
    heading: "Structured BOQ Management with Quantara",
    paragraphs: ["Quantara provides a purpose-built environment for BOQ administration. It uses a logical hierarchy where projects contain sections and sections contain items with attributes such as descriptions, units and quantities.","Teams can keep core BOQ records in this structure while continuing to use spreadsheet import and export where appropriate. Revisions, templates and generated outputs still require professional review."]
  },
  relevantFeatures: [{"name":"Hierarchical Structure","capabilityId":"boq-management","description":"Manage nested sections and line items."},{"name":"BOQ Revision Records","capabilityId":"boq-management","description":"Keep distinct revision records; users review and interpret the changes."},{"name":"Available Templates","capabilityId":"document-templates","description":"Apply supported formats where configured and review every result."}],
  workflowExample: {
    heading: "BOQ Standardization Workflow",
    introduction: "How a contractor standardizes an incoming, messy BOQ:",
    steps: [{"title":"Import Data","description":"Supported BOQ data is captured from a text-based PDF or imported spreadsheet."},{"title":"Apply Structure","description":"Items are organized into the required BOQ sections."},{"title":"Rate Application","description":"The estimator applies reviewed rates within the BOQ record."},{"title":"Peer Review","description":"A responsible professional reviews the structured data."},{"title":"Output Review","description":"A generated PDF is checked before any bid submission."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","capabilityId":"spreadsheet-import","description":"Import supported structured spreadsheet data for review."},{"name":"Text-based PDF","capabilityId":"text-pdf-extraction","description":"Store extractable text and create review candidates from supported detected table rows."},{"name":"Scanned/Image-Only PDF — Detection","capabilityId":"scanned-pdf-detection","description":"Detects image-only pages and reports that text extraction is unavailable.","limitation":"Quantara does not provide OCR; manual transcription is required."},{"name":"Scanned/Image-Only PDF — OCR","capabilityId":"scanned-pdf-ocr","description":"Automated text recognition for image-based documents is not currently implemented.","limitation":"Scanned pages require manual transcription."},{"name":"IFC","capabilityId":"model-file-import","description":"Model data integration is not currently available."}],
  supportedOutputs: [{"name":"XLSX Export","capabilityId":"professional-outputs","description":"Structured spreadsheet output."},{"name":"PDF Generation","capabilityId":"professional-outputs","description":"Professional document generation."},{"name":"Technical Reports","capabilityId":"technical-report-generation","description":"DOCX project summaries in supported configured environments.","limitation":"Durable production storage must be confirmed during Controlled Early Access."}],
  limitations: ["Quantara is a BOQ management tool, not a full ERP or accounting system.","It does not automatically generate pricing data without user input.","All structural changes and rate applications require professional review."],
  faqs: [{"question":"What does BOQ software do?","answer":"BOQ software provides a structured environment to manage the hierarchy, items, quantities and revisions of a Bill of Quantities."},{"question":"Who uses BOQ software?","answer":"It is primarily used by contractors, estimators, quantity surveyors and commercial managers in the construction industry."},{"question":"Can BOQ software replace Excel?","answer":"Not entirely. Quantara can hold structured BOQ records and supports spreadsheet import and export, while Excel may remain useful for bespoke calculations, pricing analysis and data exchange."},{"question":"What information is stored in a BOQ?","answer":"A BOQ typically stores hierarchical sections, item descriptions, quantities, units of measure, rates and total amounts."},{"question":"How are BOQ revisions managed?","answer":"In Quantara, revisions are retained as distinct project records. Users must still review and interpret what changed between versions."},{"question":"Can multiple projects be managed?","answer":"Quantara provides a centralized workspace for authorized project records, subject to current access and entitlement."},{"question":"Does BOQ software calculate rates automatically?","answer":"The software can calculate supported totals from user-provided rates and quantities, but it does not invent or automatically determine commercial rates."},{"question":"How does Quantara handle professional review?","answer":"All captured and structured data must be reviewed and approved by a qualified professional before commercial use."}],
  relatedPages: [{"href":"/boq-management","label":"BOQ Management","description":"Deep dive into project control and governance."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Understand how BOQs support the estimating workflow."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Software support for professional QS workflows."},{"href":"/boq-document-generation","label":"Document Generation","description":"Creating professional outputs from structured data."},{"href":"/about","label":"About Quantara","description":"Learn about the Vista By Lara team behind Quantara."}]
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/boq-software" />;
}
