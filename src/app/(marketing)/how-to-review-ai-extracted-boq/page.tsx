import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "How to Review an AI-Extracted BOQ",
  description: "Follow a structured review process for AI-extracted BOQ content, including scope, quantities, units, descriptions, revisions and source-document checks.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/how-to-review-ai-extracted-boq",
  },
  openGraph: {
    title: "How to Review an AI-Extracted BOQ | Quantara",
    description: "Follow a structured review process for AI-extracted BOQ content, including scope, quantities, units, descriptions, revisions and source-document checks.",
    url: "https://quantara.vistabylara.com/how-to-review-ai-extracted-boq",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "How to Review an AI-Extracted BOQ Before Professional Use",
    title: "How to Review an AI-Extracted BOQ Before Professional Use",
    summary: "AI-assisted extraction dramatically speeds up the process of turning PDF documents into structured digital BOQs. However, AI is an assistive tool, not a replacement for a quantity surveyor or estimator. A rigorous, structured human review workflow is mandatory to validate the accuracy of the data before it is used for pricing or contracts.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "The Importance of Human Review",
    "paragraphs": [
      "For commercial teams, speed must not compromise accuracy. While AI handles the heavy lifting of data entry and table structuring, it cannot apply engineering judgment or commercial context.",
      "Professionals must verify that the extracted output perfectly matches the client's original intent."
    ]
  },
  {
    "id": "the-workflow",
    "heading": "Source-to-Output Quality Control Workflow",
    "numberedItems": [
      "Confirm the source file: Ensure the AI extracted the correct, latest revision of the document.",
      "Review section structure: Check that headers, sub-headers, and trade breakdowns were categorized correctly.",
      "Compare item descriptions: Spot-check complex, multi-line descriptions for truncated text.",
      "Check quantities: Pay special attention to decimal placement, which can be misread in poor-quality scans.",
      "Check units: Verify that standard units (m, m2, nr) were captured accurately and not mangled by OCR.",
      "Identify omitted rows: Look for items that may have been skipped due to page breaks or obscure formatting.",
      "Identify duplicated rows: Ensure headers repeating across pages didn't create duplicate items.",
      "Review symbols and technical text: Check engineering symbols (Ø, °, ±) for translation errors.",
      "Check assumptions and exclusions: Ensure preliminary text and preamble notes were extracted and read.",
      "Verify totals and formulas: Re-sum the quantities and amounts to ensure they match the source summary page.",
      "Confirm output formatting: Ensure the data exports cleanly to Excel or your estimating software.",
      "Obtain qualified professional approval: A senior estimator or QS must sign off on the reviewed data."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical estimator uses AI to extract a 200-page civil works BOQ. The AI structures 99% of the document perfectly.",
      "However, on page 42, a coffee stain on the original scan caused the AI to misinterpret a section header as a measurable item. By following Step 2 and Step 6 of the review workflow, the estimator catches this anomaly instantly, deletes the rogue item, and proceeds with a verified document."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of AI Extraction",
    "paragraphs": [
      "AI extraction models are probabilistic. They make highly educated guesses based on layout patterns, but they do not \"read\" the drawings to verify if the quantities are physically correct.",
      "The AI only extracts what is on the page. If the original BOQ was flawed, the extracted BOQ will be flawed."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports Review",
    "paragraphs": [
      "Quantara provides a side-by-side verification interface, allowing users to instantly compare the extracted digital data against the original PDF source document, making the review workflow rapid and intuitive.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "Does AI guarantee 100% accuracy?",
    "answer": "No. While AI extraction is highly accurate on clean documents, variables like scan quality and unusual formatting always require human validation."
  },
  {
    "question": "Who is responsible for the extracted data?",
    "answer": "The professional (estimator or QS) utilizing the data is always responsible for its accuracy and final commercial application."
  },
  {
    "question": "How long does the review take?",
    "answer": "A structured review of an extracted document takes a fraction of the time it would take to manually retype the data, often reducing days of work to hours."
  },
  {
    "question": "What if the AI misses a page?",
    "answer": "Structured workflows include page-count and section-total checks to immediately identify if data was dropped during processing."
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
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "How to Review an AI-Extracted BOQ Before Professional Use",
      "description": "Follow a structured review process for AI-extracted BOQ content, including scope, quantities, units, descriptions, revisions and source-document checks.",
      "url": "https://quantara.vistabylara.com/how-to-review-ai-extracted-boq",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
