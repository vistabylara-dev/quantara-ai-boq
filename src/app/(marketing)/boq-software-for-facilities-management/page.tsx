import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import IndustryLandingPage, { IndustryLandingPageContent } from "@/components/layout/industry-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-software-for-facilities-management", locale);
}



export default function Page() {
  const content: IndustryLandingPageContent = {
    breadcrumbLabel: "BOQ Software for Facilities Management",
    title: "BOQ Software for Facilities Management Projects and Service Scope",
    audienceDescription: "For facilities-management companies evaluating structured BOQ workflows for project-based maintenance, repair and refurbishment scope.",
    directAnswer: "Quantara helps facilities-management teams organize supported maintenance, repair and refurbishment scope into reviewed BOQ records.",
    challenges: [
  {
    "title": "Ad-Hoc Project Scopes",
    "description": "FM teams often deal with poorly structured, ad-hoc scopes of work for repairs that are difficult to standardize into professional BOQs."
  },
  {
    "title": "Recurring Service Packages",
    "description": "Similar reactive and planned maintenance tasks can involve repeated BOQ organization and review work."
  }
],
    workflowDescription: "Quantara can organize supported maintenance, repair, refurbishment and planned-work scope in BOQ sections. Available templates can support consistent formatting, while contractor comparisons and revision interpretation remain professional tasks.",
    workflowExample: "A facilities-management team prepares a refurbishment BOQ from reviewed site notes and supplier files. It uses an available template, enters verified site quantities and checks the generated document before contractor issue.",
    typicalCategories: [
  "Planned Preventative Maintenance (PPM)",
  "Reactive Repairs",
  "Refurbishment Works",
  "Asset Replacement",
  "Cleaning and Soft Services",
  "MEP Servicing",
  "Preliminaries"
],
    supportedInputs: [
  "Text-based PDF",
  "Scanned PDF (detection only — OCR not currently available)",
  "XLSX",
  "CSV"
],
    plannedInputs: [
  "CAD",
  "BIM",
  "IFC"
],
    supportedOutputs: [
  "Structured Excel (XLSX)",
  "Reviewable PDF Outputs",
  "CSV Exports"
],
    limitations: [
  "Quantara is not an asset-management system or a CMMS (Computerized Maintenance Management System).",
  "Quantara does not provide live work-order tracking or ticketing.",
  "Quantara focuses strictly on the BOQ and estimating document workflow."
],
    faqs: [
  {
    "question": "Can facilities-management teams reuse BOQ templates?",
    "answer": "FM teams can use available BOQ templates where configured. The scope, quantities and output still require project-specific review."
  },
  {
    "question": "Is Quantara a CMMS?",
    "answer": "No. Quantara is a BOQ and document workflow platform. It is not a Computerized Maintenance Management System for live ticketing."
  },
  {
    "question": "Can I manage reactive repair BOQs?",
    "answer": "Supported reactive-repair scope can be organized into BOQ sections. Review effort depends on the source and project requirements."
  },
  {
    "question": "How does it help with contractor comparisons?",
    "answer": "A reviewed BOQ can present the same item structure to multiple contractors. The FM team must still reconcile qualifications, exclusions and returned pricing before comparison."
  },
  {
    "question": "Does it track physical assets?",
    "answer": "No, Quantara manages the documents and BOQ items related to the assets, but it does not track live asset health or inventory."
  },
  {
    "question": "Can I structure PPM schedules?",
    "answer": "You can structure the commercial and pricing elements of a PPM schedule as a BOQ, but it does not execute the actual maintenance scheduling."
  },
  {
    "question": "How are refurbishment projects handled?",
    "answer": "Refurbishments are treated as standard construction BOQs, allowing you to organize demolition, finishes, and MEP works logically."
  },
  {
    "question": "Can I export the data to Excel?",
    "answer": "Reviewed data can be exported as XLSX for manual use or import elsewhere. Compatibility with another FM or financial system is not guaranteed."
  }
],
    relatedPages: [
  {
    "href": "/boq-management",
    "label": "BOQ Management"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/boq-document-generation",
    "label": "BOQ Document Generation"
  },
  {
    "href": "/about",
    "label": "About Quantara"
  }
],
    path: "/boq-software-for-facilities-management"
  };

  return <IndustryLandingPage content={content} />;
}
