import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "Quantity Takeoff vs BOQ Management Software | Quantara",
  description: "Compare quantity takeoff with BOQ management, including measurement, document structure, revisions, templates and professional project workflows.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/quantity-takeoff-vs-boq-management",
  },
  openGraph: {
    title: "Quantity Takeoff vs BOQ Management Software | Quantara",
    description: "Compare quantity takeoff with BOQ management, including measurement, document structure, revisions, templates and professional project workflows.",
    url: "https://quantara.vistabylara.com/quantity-takeoff-vs-boq-management",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "Quantity Takeoff vs BOQ Management",
    title: "Quantity Takeoff vs BOQ Management: Different Construction Workflows",
    summary: "Quantity Takeoff and BOQ Management are two distinct, sequential phases of construction estimating. Takeoff involves measuring physical dimensions from drawings or models. BOQ Management involves organizing those measurements, along with descriptions and rates, into structured, contract-ready documents.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why the Distinction Matters",
    "paragraphs": [
      "For contractors and quantity surveyors, confusing these two software categories leads to inefficient workflows. Buying a takeoff tool won't help you manage complex tender revisions, and buying a BOQ tool won't help you measure a PDF drawing.",
      "Understanding the boundary ensures you deploy the right tools for the right job."
    ]
  },
  {
    "id": "core-differences",
    "heading": "Measurement vs Administration",
    "bullets": [
      "Quantity Takeoff: The act of measuring scope. It involves clicking on PDFs, CAD files, or BIM models to count elements, calculate lengths, areas, and volumes.",
      "BOQ Management: The administration of the project scope. It involves creating sections, writing detailed items, importing the quantities generated during takeoff, applying units, managing templates, and handling document revisions."
    ]
  },
  {
    "id": "comparison-table",
    "heading": "Workflow Comparison",
    "table": {
      "headers": [
        "Feature",
        "Quantity Takeoff Software",
        "BOQ Management Software"
      ],
      "rows": [
        [
          "Primary Input",
          "Drawings, Blueprints, BIM Models",
          "Extracted PDFs, Spreadsheets, Takeoff Data"
        ],
        [
          "Primary Action",
          "Measuring and Counting",
          "Structuring, Organizing, and Revising"
        ],
        [
          "Key Outputs",
          "Raw dimensional data (areas, lengths)",
          "Structured Bill of Quantities documents"
        ],
        [
          "Focus Area",
          "Visual and geometric accuracy",
          "Document control and commercial structuring"
        ]
      ]
    }
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical estimator is pricing a concrete slab.",
      "First, they use Takeoff Software to trace the drawing and calculate the slab area as 500 m2.",
      "Next, they use BOQ Management Software to create the formal item: \"Supply and pour C30 concrete slab, 200mm thick,\" input the 500 m2 quantity, apply a unit rate, and publish the document as Revision 2."
    ]
  },
  {
    "id": "quantara-boundary",
    "heading": "The Quantara Product Boundary",
    "paragraphs": [
      "It is vital to understand category boundaries to manage expectations.",
      "Quantara currently focuses on supported document extraction and structured BOQ management. Automated visual quantity takeoff, drawing measurement, CAD, BIM and IFC processing remain Planned unless explicitly marked otherwise."
    ],
    "note": "Quantara organizes your data; it does not measure the drawings for you at this stage."
  }
],
    faqs: [
  {
    "question": "Can BOQ software do takeoff?",
    "answer": "Most dedicated BOQ management tools focus on data structure rather than visual measurement, though some integrated platforms offer both modules."
  },
  {
    "question": "Do I need both types of software?",
    "answer": "Yes, typically. An estimator measures the project (Takeoff) and then builds the commercial document (BOQ)."
  },
  {
    "question": "What is 2D takeoff?",
    "answer": "2D takeoff is measuring dimensions manually by clicking points on a flat PDF or CAD drawing."
  },
  {
    "question": "What is BIM takeoff?",
    "answer": "BIM takeoff involves extracting dimensional data directly from a 3D model's embedded properties."
  },
  {
    "question": "Which step comes first?",
    "answer": "Takeoff comes first. The measured quantities are then fed into the BOQ structure."
  }
],
    relatedReading: [
  {
    "href": "/boq-management",
    "label": "BOQ Management Software"
  },
  {
    "href": "/quantity-surveying-software",
    "label": "Quantity Surveying Software"
  },
  {
    "href": "/what-is-a-boq",
    "label": "What Is a BOQ?"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "Quantity Takeoff vs BOQ Management: Different Construction Workflows",
      "description": "Compare quantity takeoff with BOQ management, including measurement, document structure, revisions, templates and professional project workflows.",
      "url": "https://quantara.vistabylara.com/quantity-takeoff-vs-boq-management",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
