import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "Common BOQ Errors and How to Review Them",
  description: "Learn common Bill of Quantities errors involving scope, descriptions, units, quantities, duplicates, omissions, revisions and document formatting.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/common-boq-errors",
  },
  openGraph: {
    title: "Common BOQ Errors and How to Review Them | Quantara",
    description: "Learn common Bill of Quantities errors involving scope, descriptions, units, quantities, duplicates, omissions, revisions and document formatting.",
    url: "https://quantara.vistabylara.com/common-boq-errors",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "Common BOQ Errors That Require Professional Review",
    title: "Common BOQ Errors That Require Professional Review",
    summary: "Bills of Quantities are highly detailed documents, making them susceptible to human error during preparation, extraction, and pricing. Identifying common BOQ errors—such as incorrect units, missed scope, and formula breakdowns—is a crucial skill for estimators and commercial teams to protect project profitability.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why Error Detection Matters",
    "paragraphs": [
      "For contractors and MEP teams, a single missing zero on a high-value quantity or an ambiguous description can result in thousands of dollars in lost margins.",
      "Understanding the most frequent failure points allows teams to target their review efforts where risk is highest."
    ]
  },
  {
    "id": "common-errors",
    "heading": "The Most Frequent BOQ Errors",
    "bullets": [
      "Missing Items: Scope shown on the drawings but entirely absent from the BOQ.",
      "Duplicated Scope: The same item measured twice, often occurring at the boundary between trades (e.g., builders work in connection with MEP).",
      "Incorrect Units: Measuring linear items (pipes) in square meters, or volume in linear meters.",
      "Ambiguous Descriptions: Failing to specify the exact material grade, finish, or installation method.",
      "Quantity Transcription Errors: A decimal point in the wrong place (e.g., 100.0 instead of 10.00).",
      "Outdated Revisions: Pricing a BOQ based on Revision A drawings when Revision C has already been issued.",
      "Formula Errors: In spreadsheet BOQs, sum formulas that fail to capture newly inserted rows.",
      "Hidden Assumptions: Relying on verbal agreements without writing them into the BOQ exclusions."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "Consider a hypothetical excavation project. The BOQ lists the unit for soil removal as \"m2\" (square meters) instead of \"m3\" (cubic meters).",
      "An estimator might price the area perfectly, but fail to account for the depth of the excavation. When the trucks arrive to haul the soil, the contractor realizes they have underpriced the haulage by a factor of ten due to a simple unit error."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations of Software Error Detection",
    "paragraphs": [
      "No software can eliminate all BOQ errors. A system might flag that a unit looks unusual or a formula is broken, but it cannot know that the architect verbally changed the specification yesterday.",
      "Professional human review is always required to validate engineering intent and commercial context."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Helps Mitigate Errors",
    "paragraphs": [
      "Quantara reduces data-entry errors by structurally extracting PDF BOQs rather than forcing manual re-typing. It maintains a clean, structured database of your items, making it easier to spot inconsistencies.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "What is the most expensive BOQ error?",
    "answer": "Usually, complete omission of a major scope item or a misplaced decimal point in a high-volume, high-rate item."
  },
  {
    "question": "How do you fix an error in a client BOQ?",
    "answer": "During the tender phase, contractors submit a formal Tender Query or Request for Information (RFI) to the client asking for clarification or a revised BOQ."
  },
  {
    "question": "Can OCR software cause BOQ errors?",
    "answer": "Yes. Optical Character Recognition can mistake a \"1\" for an \"l\" or an \"S\" for a \"5\". All OCR-extracted quantities must be professionally reviewed."
  },
  {
    "question": "Are formula errors common?",
    "answer": "Extremely common. When estimators insert rows into complex Excel sheets, standard SUM formulas often fail to update, leading to incorrect totals."
  },
  {
    "question": "Who pays for a BOQ error?",
    "answer": "It depends on the contract. In a lump-sum contract, the contractor usually bears the risk of quantity errors. In a remeasurable contract, the client pays for the actual work done."
  }
],
    relatedReading: [
  {
    "href": "/boq-review-checklist",
    "label": "BOQ Review Checklist"
  },
  {
    "href": "/ocr-for-boq-documents",
    "label": "OCR for BOQ Documents"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "How to Review AI-Extracted BOQs"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "Common BOQ Errors That Require Professional Review",
      "description": "Learn common Bill of Quantities errors involving scope, descriptions, units, quantities, duplicates, omissions, revisions and document formatting.",
      "url": "https://quantara.vistabylara.com/common-boq-errors",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
