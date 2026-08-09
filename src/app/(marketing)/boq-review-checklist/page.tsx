import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/boq-review-checklist");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "BOQ Review Checklist Before Tender, Pricing or Issue",
    title: "BOQ Review Checklist Before Tender, Pricing or Issue",
    summary: "A thorough review of a Bill of Quantities (BOQ) is a critical quality control step before submitting a tender, issuing a document to subcontractors, or signing a contract. This practical checklist helps estimators and commercial teams systematically identify errors, omissions, and commercial risks within the BOQ structure.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why a Formal Review Matters",
    "paragraphs": [
      "For contractors, commercial managers and estimators, discovering a material BOQ error after contract award can create cost and scope disputes.",
      "Whether the BOQ comes from a client or an internal team, a structured review helps document assumptions and test quantities against the available project information."
    ]
  },
  {
    "id": "the-checklist",
    "heading": "Comprehensive Review Checklist",
    "checklists": [
      {
        "groupTitle": "Document and Version Control",
        "items": [
          "Confirm the BOQ references the correct project name and client details.",
          "Verify the BOQ revision number matches the latest issued addenda.",
          "Check that all referenced drawing numbers and specification dates match the current set.",
          "Ensure a formal revision history is present and changes are tracked."
        ]
      },
      {
        "groupTitle": "Scope and Descriptions",
        "items": [
          "Check for missing scope (items on drawings but not in the BOQ).",
          "Check for duplicated scope (items appearing in multiple sections or trades).",
          "Ensure item descriptions are unambiguous and reference the correct specification clauses.",
          "Verify that assumptions regarding ambiguous scope are explicitly documented.",
          "Confirm that exclusions (e.g., client-supplied items) are clearly stated."
        ]
      },
      {
        "groupTitle": "Quantities and Measurement",
        "items": [
          "Spot-check major quantities against high-level drawing measurements.",
          "Verify that appropriate units of measurement are used (e.g., m2 for areas, m3 for volumes).",
          "Check for obvious transcription or decimal placement errors in quantities.",
          "Ensure provisional quantities are clearly marked as subject to remeasurement."
        ]
      },
      {
        "groupTitle": "Pricing and Formatting (if applicable)",
        "items": [
          "Verify that all rates have been entered and no items have been left blank accidentally.",
          "Check that section totals sum correctly to the summary page.",
          "Ensure formatting, page breaks, and table structures are intact.",
          "Obtain final professional approval and signature from a qualified senior reviewer."
        ]
      }
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "During a review of a hypothetical plumbing BOQ, an estimator uses this checklist and notices an item for \"150mm copper pipe\" has a unit of \"m2\" instead of linear meters (\"m\").",
      "Catching the unit error before pricing avoids applying an area rate to a linear quantity and prompts the estimator to recalculate the item correctly."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of a Checklist",
    "paragraphs": [
      "No checklist can replace professional experience. It can prompt source checks, but it cannot determine whether a design or commercial assumption is appropriate.",
      "Always require a qualified construction professional to interpret the technical nuances of the scope."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports BOQ Review",
    "paragraphs": [
      "Quantara captures supported information from text-based PDF BOQs into a review workflow. Users confirm, correct or reject captured information before relying on it in later BOQ work.",
      "Supported deterministic calculation types can show their inputs and equation for review. Quantara does not automatically detect every missing item or validate an entire tender."
    ]
  }
],
    faqs: [
  {
    "question": "Who should review the BOQ?",
    "answer": "A BOQ should be reviewed by a senior estimator, commercial manager, or qualified quantity surveyor who was ideally not the person who initially prepared it."
  },
  {
    "question": "When should the review take place?",
    "answer": "A review should occur before a consultant issues the BOQ for tender, and again by the contractor before submitting their priced bid."
  },
  {
    "question": "What is a provisional sum check?",
    "answer": "Review provisional sums to check whether allowances for undefined work are identified separately and whether any scope appears elsewhere in measured items."
  },
  {
    "question": "How do you check formulas in a PDF BOQ?",
    "answer": "A PDF normally shows results rather than editable formulas. Recalculate the relevant totals in a controlled worksheet or other suitable review tool and reconcile them with the source. Quantara only exposes visible equations for supported deterministic calculation types."
  },
  {
    "question": "Why check specification references?",
    "answer": "An item might say \"Standard door,\" while the specification reference requires a fire-rated acoustic door. Checking the reference helps reduce underpricing risk."
  }
],
    relatedReading: [
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "Reviewing AI-Extracted BOQs"
  },
  {
    "href": "/boq-revision-control",
    "label": "BOQ Revision Control"
  }
],
    path: "/boq-review-checklist"
  };

  return <KnowledgePage content={content} />;
}
