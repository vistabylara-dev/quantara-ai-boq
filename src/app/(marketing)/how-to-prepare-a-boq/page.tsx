import { Metadata } from "next";
import Link from "next/link";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "How to Prepare a BOQ: Step-by-Step Construction Workflow | Quantara",
  description: "Follow a practical workflow for preparing a Bill of Quantities from project documents, including scope review, item structure, quantities and professional validation.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/how-to-prepare-a-boq",
  },
  openGraph: {
    title: "How to Prepare a BOQ: Step-by-Step Construction Workflow | Quantara",
    description: "Follow a practical workflow for preparing a Bill of Quantities from project documents, including scope review, item structure, quantities and professional validation.",
    url: "https://quantara.vistabylara.com/how-to-prepare-a-boq",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "How to Prepare a BOQ",
    title: "How to Prepare a BOQ: A Structured Step-by-Step Workflow",
    summary: "Preparing a Bill of Quantities (BOQ) is a meticulous process that requires translating architectural, structural, and MEP drawings into a standardized, line-by-line list of measurable items. Following a structured workflow ensures that all project scope is captured, quantities are accurate, and the final document is ready for competitive tendering or pricing.",
    directAnswer: "Preparing a BOQ requires systematically reviewing construction drawings, defining the scope of work, structuring sections by trade or element, drafting item descriptions, and measuring precise quantities. The final document must undergo professional validation before being issued for tender.",
    keyTakeaways: [
      "Review the latest 'Issued for Construction' or 'Tender' drawings.",
      "Use a logical hierarchy such as Substructure, Superstructure, and MEP.",
      "Accurate quantities and clear item descriptions prevent future disputes."
    ],
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why a Structured Workflow Matters",
    "paragraphs": [
      "For quantity surveyors, consultants, and estimating teams, missing a scope item during BOQ preparation can lead to massive cost overruns or legal disputes during construction.",
      <>A standardized preparation process minimizes omissions, reduces ambiguity, and produces a professional document that contractors can price with confidence. This is especially true when transitioning from <Link href="/ai-boq-vs-manual-boq-preparation" className="text-blue-600 hover:underline font-medium">manual preparation to software</Link>.</>
    ]
  },
  {
    "id": "the-workflow",
    "heading": "Step-by-Step Preparation Workflow",
    "paragraphs": [
      "While project requirements and measurement conventions vary depending on the contract and local practice, a robust preparation workflow typically involves the following steps:"
    ],
    "numberedItems": [
      "Review available project information: Gather all drawings, specifications, schedules, and contract conditions.",
      "Confirm document revisions: Ensure you are working from the latest \"Issued for Construction\" or \"Tender\" drawings.",
      "Define scope boundaries: Identify what is in the contract and what is excluded (e.g., client-supplied materials).",
      "Select the measurement approach: Confirm if you are using a standard method of measurement or a bespoke project format.",
      "Establish BOQ sections: Create a logical hierarchy (e.g., Substructure, Superstructure, Finishes, MEP).",
      "Draft item descriptions: Write clear, unambiguous descriptions that reference the specifications.",
      "Record quantities and units: Perform the takeoff and enter the net quantities alongside standard units (m2, m3, linear meters, nr).",
      "Capture assumptions and exclusions: Document any areas where the drawings were unclear and assumptions had to be made.",
      "Check cross-references: Ensure item descriptions correctly point to the relevant specification clauses.",
      "Review missing or duplicated scope: Perform a gap analysis across trades to ensure no overlap.",
      "Apply rates (if required): If building an internal estimate or a cost plan, apply rates to the quantities.",
      "Complete professional validation: Have a senior surveyor or estimator review the document for errors.",
      "Issue a controlled revision: Publish the document with a clear revision number and date."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "Imagine preparing a BOQ for a generic interior office fit-out.",
      "Step 5 (Sections): You divide the work into Demolition, Partitions, Ceilings, and Electrical.",
      "Step 6 (Descriptions): Instead of writing \"Paint walls,\" you write \"Prepare and apply two coats of emulsion paint to new gypsum partitions, in accordance with spec ref A.12.\"",
      "Step 7 (Quantities): You enter \"450 m2\"."
    ]
  },
  {
    "id": "limitations",
    "heading": "Common Mistakes and Limitations",
    "paragraphs": [
      "The most dangerous mistake in preparing a BOQ is proceeding with outdated drawings. If a revision is missed, the BOQ is instantly incorrect.",
      "Additionally, failing to clearly define what is included in an item description (e.g., does the door item include the hinges and locks?) will lead to pricing variations and claims."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Connects to the Workflow",
    "paragraphs": [
      "While consultants prepare the initial BOQ, contractors receive them in various formats (often PDF). Quantara helps contractors instantly structure these received documents back into a workable, digital format.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs. Automated drawing measurement remains Planned unless explicitly marked otherwise."
    ]
  }
],
    faqs: [
  {
    "question": "What software is used to prepare a BOQ?",
    "answer": "BOQs are traditionally prepared using spreadsheets (Excel) or dedicated estimating and quantity surveying software."
  },
  {
    "question": "Do I need drawings to prepare a BOQ?",
    "answer": "Yes, accurate drawings, models, and specifications are essential to measure the quantities and define the scope of work."
  },
  {
    "question": "Who is responsible for BOQ accuracy?",
    "answer": "Typically, the party that issues the BOQ (the client's quantity surveyor) is responsible for its accuracy, though some contracts shift this risk to the contractor."
  },
  {
    "question": "How do you structure BOQ sections?",
    "answer": "Sections are usually structured logically by trade (e.g., masonry, carpentry), by elemental breakdown (e.g., substructure, roof), or by physical location (e.g., Building A, Building B)."
  },
  {
    "question": "What happens if an item is missed in the BOQ?",
    "answer": "If a required item is shown on the drawings but missed in the BOQ, the financial responsibility depends on the specific conditions of the contract."
  }
],
    relatedReading: [
  {
    "href": "/boq-review-checklist",
    "label": "BOQ Review Checklist"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "How to Prepare a BOQ: A Structured Step-by-Step Workflow",
      "description": "Follow a practical workflow for preparing a Bill of Quantities from project documents, including scope review, item structure, quantities and professional validation.",
      "url": "https://quantara.vistabylara.com/how-to-prepare-a-boq",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
