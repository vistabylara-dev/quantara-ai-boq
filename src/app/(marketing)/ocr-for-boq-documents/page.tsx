import { Metadata } from "next";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "OCR for BOQ Documents: Capabilities and Limitations",
  description: "Learn how OCR can assist with scanned BOQ documents, which errors may occur, and what professionals should review before using extracted content.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/ocr-for-boq-documents",
  },
  openGraph: {
    title: "OCR for BOQ Documents: Capabilities and Limitations | Quantara",
    description: "Learn how OCR can assist with scanned BOQ documents, which errors may occur, and what professionals should review before using extracted content.",
    url: "https://quantara.vistabylara.com/ocr-for-boq-documents",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "OCR for BOQ Documents",
    title: "OCR for BOQ Documents: What It Can and Cannot Do",
    summary: "Optical Character Recognition (OCR) is the technology used to convert scanned, image-based Bills of Quantities into editable, structured text. While modern OCR significantly reduces manual data entry, the complexity of BOQ tables, technical symbols, and numbers means it is an assistive tool, not a perfect replacement for human review.",
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why OCR Understanding Matters",
    "paragraphs": [
      "For commercial teams processing legacy documents or consultant scans, OCR is essential. However, blindly trusting OCR outputs can lead to devastating estimating errors.",
      "Knowing exactly where OCR struggles allows estimators to focus their quality-control checks on high-risk areas."
    ]
  },
  {
    "id": "capabilities",
    "heading": "What OCR Does Well",
    "bullets": [
      "High-Resolution Text: Clean, high-DPI scans of standard fonts are recognized with near-perfect accuracy.",
      "Standard Layouts: Simple, grid-based tables without complex merged cells are generally reconstructed well.",
      "Bulk Processing: OCR can read a 200-page scanned document infinitely faster than a human can type it."
    ]
  },
  {
    "id": "limitations",
    "heading": "Where OCR Struggles (The Limitations)",
    "paragraphs": [
      "OCR interprets shapes, not engineering intent. Common failure points include:"
    ],
    "bullets": [
      "Similar Characters: Confusing a capital \"I\" with a lowercase \"l\" or the number \"1\".",
      "Decimal Points: Faded or small decimal points in quantities may be completely ignored (turning 10.5 into 105).",
      "Technical Symbols: Specialized engineering symbols (e.g., diameter Ø) may be translated as strange text characters.",
      "Skew and Noise: Crooked pages, staple marks, or coffee stains can confuse the table reconstruction algorithms.",
      "Handwriting: Handwritten annotations or corrections are notoriously difficult for standard OCR to parse accurately."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "A hypothetical contractor scans a BOQ page that includes the item \"m3\" (cubic meters). Because the page is slightly blurry, the OCR engine reads the \"3\" as an \"8\", outputting \"m8\".",
      "A human reviewer must spot this unit error during the validation phase to ensure the estimating software can process the data correctly."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Uses OCR",
    "paragraphs": [
      "Quantara utilizes AI-assisted OCR workflows to extract data from scanned BOQs while maintaining the structural hierarchy of the document. The platform is designed to make the human review and correction process as seamless as possible.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs. It does not perform professional measurement or scope interpretation."
    ]
  }
],
    faqs: [
  {
    "question": "What does OCR mean?",
    "answer": "Optical Character Recognition. It translates images of text into actual digital text data."
  },
  {
    "question": "Is OCR 100% accurate?",
    "answer": "No. Even the best OCR systems can make mistakes on poor-quality scans, blurry text, or non-standard fonts."
  },
  {
    "question": "How can I improve OCR accuracy?",
    "answer": "Ensure the original documents are scanned straight (no skew), at a high resolution (minimum 300 DPI), and without handwritten marks over the text."
  },
  {
    "question": "Can OCR read tables?",
    "answer": "Modern OCR engines can detect grid lines and whitespace to reconstruct tables, though complex merged cells often require human adjustment."
  },
  {
    "question": "Does OCR understand construction terminology?",
    "answer": "Basic OCR only reads letters. AI-assisted tools (like Quantara) apply construction-specific context to improve the structuring of the extracted data."
  }
],
    relatedReading: [
  {
    "href": "/scanned-pdf-boq",
    "label": "Scanned PDF BOQ Processing"
  },
  {
    "href": "/text-pdf-vs-scanned-pdf",
    "label": "Text PDF vs Scanned PDF"
  },
  {
    "href": "/how-to-review-ai-extracted-boq",
    "label": "Reviewing AI-Extracted BOQs"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "OCR for BOQ Documents: What It Can and Cannot Do",
      "description": "Learn how OCR can assist with scanned BOQ documents, which errors may occur, and what professionals should review before using extracted content.",
      "url": "https://quantara.vistabylara.com/ocr-for-boq-documents",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
