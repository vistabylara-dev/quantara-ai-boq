import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/how-to-review-ai-extracted-boq");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "How to Review an AI-Extracted BOQ Before Professional Use",
    title: "How to Review an AI-Extracted BOQ Before Professional Use",
    summary: "AI-assisted extraction can help turn supported source content into structured digital BOQ candidates. It is an assistive workflow, not a replacement for a quantity surveyor or estimator, and every result requires structured human review before pricing or contractual use.",
    isHowTo: true,
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "The Importance of Human Review",
    "paragraphs": [
      "For commercial teams, convenience must not replace accuracy. AI can assist with supported capture and table structuring, but it cannot apply engineering judgment or commercial context.",
      "Professionals must compare the captured result with the source and confirm that the resulting BOQ reflects the intended commercial record."
    ]
  },
  {
    "id": "the-workflow",
    "heading": "Source-to-Output Quality Control Workflow",
    "numberedItems": [
      "Confirm the source file: Ensure the AI extracted the correct, latest revision of the document.",
      "Review section structure: Check that headers, sub-headers, and trade breakdowns were categorized correctly.",
      "Compare item descriptions: Spot-check complex, multi-line descriptions for truncated text.",
      "Check quantities: Pay special attention to decimal placement and values split across complex table layouts.",
      "Check units: Verify that standard units (m, m2, nr) were captured accurately and assigned to the correct items.",
      "Identify omitted rows: Look for items that may have been skipped due to page breaks or obscure formatting.",
      "Identify duplicated rows: Ensure headers repeating across pages didn't create duplicate items.",
      "Review symbols and technical text: Check engineering symbols (Ø, °, ±) for translation errors.",
      "Check assumptions and exclusions: Ensure preliminary text and preamble notes were extracted and read.",
      "Verify totals and formulas: Re-sum the quantities and amounts to ensure they match the source summary page.",
      "Confirm output formatting: Ensure the exported data retains the reviewed structure and values in the target format.",
      "Obtain qualified professional approval: A senior estimator or QS must sign off on the reviewed data."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical estimator imports a text-based civil works BOQ containing a multi-line heading above a table.",
      "The heading is captured as a measurable item because the table structure is ambiguous. By checking the section structure and source content, the estimator identifies the issue, corrects the candidate and continues the review."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of AI Extraction",
    "paragraphs": [
      "AI extraction models use statistical patterns and can return incorrect results. They do not verify whether captured quantities are physically correct.",
      "Capture can omit, misread or restructure source content, and it cannot correct a flawed source BOQ without professional intervention."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports Review",
    "paragraphs": [
      "Quantara provides source records, captured information and review actions. Reviewers should compare each candidate with the original source using the available source-review screens; the exact presentation depends on the source and result.",
      "Quantara currently focuses on supported document capture, BOQ structuring, project organization, templates, revisions and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "Does AI guarantee 100% accuracy?",
    "answer": "No. Results vary with the source content and layout, and Quantara does not currently extract text from scanned or image-only PDFs. Human validation is always required."
  },
  {
    "question": "Who is responsible for the extracted data?",
    "answer": "The professional (estimator or QS) utilizing the data is always responsible for its accuracy and final commercial application."
  },
  {
    "question": "How long does the review take?",
    "answer": "There is no fixed review duration. It depends on document structure, captured content, corrections, project risk and the level of professional checking required."
  },
  {
    "question": "What if the AI misses a page?",
    "answer": "Compare the source page and section sequence with the captured result, then reconcile quantities and totals before approval. Do not assume a missing page will be detected automatically."
  },
  {
    "question": "Do I need technical skills to review AI data?",
    "answer": "You need construction and commercial skills (to understand the BOQ), but no programming or AI technical skills are required."
  }
],
    relatedReading: [
  {
    "href": "/ai-boq-software",
    "label": "AI BOQ Software"
  },
  {
    "href": "/boq-review-checklist",
    "label": "BOQ Review Checklist"
  },
  {
    "href": "/common-boq-errors",
    "label": "Common BOQ Errors"
  }
],
    path: "/how-to-review-ai-extracted-boq"
  };

  return <KnowledgePage content={content} />;
}
