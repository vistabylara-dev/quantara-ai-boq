import { Metadata } from "next";
import Link from "next/link";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata: Metadata = {
  title: "What Is a BOQ? Bill of Quantities Explained | Quantara",
  description: "Learn what a Bill of Quantities is, what it contains, who prepares it, how it supports estimating and tendering, and why professional review matters.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/what-is-a-boq",
  },
  openGraph: {
    title: "What Is a BOQ? Bill of Quantities Explained | Quantara",
    description: "Learn what a Bill of Quantities is, what it contains, who prepares it, how it supports estimating and tendering, and why professional review matters.",
    url: "https://quantara.vistabylara.com/what-is-a-boq",
    type: "article",
  },
};

export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "What Is a BOQ? A Practical Guide to Bills of Quantities",
    title: "What Is a BOQ? A Practical Guide to Bills of Quantities",
    summary: "A Bill of Quantities (BOQ) is a structured document used in construction tendering and estimating. It itemizes the materials, parts, and labor (and their costs) required to construct, maintain, or repair a specific project structure or system. The BOQ provides a level playing field for contractors to price their work on the same terms.",
    directAnswer: "A Bill of Quantities (BOQ) is a detailed, itemized list of materials, labor, and parts required for a construction project. It provides a standardized breakdown of scope, allowing all bidding contractors to price the project on the same terms and quantities.",
    keyTakeaways: [
      "A BOQ standardizes the bidding process for contractors.",
      "It contains preliminaries, measured works, and provisional sums.",
      "The BOQ forms a critical part of traditional construction contracts."
    ],
    reviewedDate: new Date().toISOString().split("T")[0],
    sections: [
  {
    "id": "understanding-boqs",
    "heading": "Why the BOQ Matters in Construction",
    "paragraphs": [
      <>For contractors, <Link href="/boq-software-for-quantity-surveyors" className="text-blue-600 hover:underline font-medium">quantity surveyors</Link>, and estimators, the Bill of Quantities is the foundation of competitive tendering. It translates complex architectural and engineering drawings into a readable, line-by-line list of tasks.</>,
      "Instead of every contractor interpreting the drawings differently and measuring their own quantities, the BOQ provides a standardized measurement. This standardization allows clients to compare bids \"apples to apples.\"",
      <>For procurement professionals, understanding how this differs from a <Link href="/boq-vs-bill-of-materials" className="text-blue-600 hover:underline font-medium">Bill of Materials</Link> is essential for proper supply chain planning.</>
    ]
  },
  {
    "id": "typical-sections",
    "heading": "Typical Sections of a BOQ",
    "paragraphs": [
      "While formats vary depending on local practice and measurement methods, most BOQs include:"
    ],
    "bullets": [
      "Preliminaries: General conditions, site management, insurance, and setup costs.",
      "Measured Works: The core construction activities broken down by trade (e.g., concrete, masonry, electrical).",
      "Provisional Sums: Allowances for unknown elements or specialized work.",
      "Prime Cost Sums: Allowances for specific materials or components to be supplied."
    ]
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "Consider a hypothetical small commercial fit-out. The BOQ section for flooring might look like this:"
    ],
    "table": {
      "headers": [
        "Item",
        "Description",
        "Qty",
        "Unit",
        "Rate",
        "Amount"
      ],
      "rows": [
        [
          "1.1",
          "Supply and install engineered timber flooring",
          "150",
          "m2",
          "",
          ""
        ],
        [
          "1.2",
          "100mm timber skirting, painted finish",
          "65",
          "m",
          "",
          ""
        ]
      ]
    },
    "note": "Rates and amounts are filled in by the bidding contractor during the tender process."
  },
  {
    "id": "limitations",
    "heading": "Common Mistakes and Limitations",
    "paragraphs": [
      "A BOQ is only as accurate as the drawings it is based on. Common issues include missed scope, ambiguous descriptions, and quantity errors.",
      "Furthermore, it is critical to distinguish between the scope of work and the final contract price. Exclusions and assumptions must be clearly stated to avoid disputes later."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports BOQ Workflows",
    "paragraphs": [
      "Quantara helps construction teams turn supported project documents into structured BOQ records. Instead of manually retyping items from a PDF, teams can extract the data into a controlled, revision-tracked environment.",
      "Quantara currently focuses on supported document extraction, BOQ structuring, project organization, templates, revisions, and professional outputs."
    ]
  }
],
    faqs: [
  {
    "question": "What does BOQ stand for?",
    "answer": "BOQ stands for Bill of Quantities."
  },
  {
    "question": "Who prepares a BOQ?",
    "answer": "A BOQ is typically prepared by a quantity surveyor, a cost consultant, or an estimator on behalf of the client or the main contractor, depending on the procurement method."
  },
  {
    "question": "Is a BOQ always priced?",
    "answer": "No. The client or consultant issues an \"unpriced BOQ\" during the tender stage. The bidding contractors fill in their rates to create a \"priced BOQ.\""
  },
  {
    "question": "Can contractors change a BOQ?",
    "answer": "Generally, contractors must price the BOQ as issued to ensure a fair comparison. If they identify errors or omissions, they usually raise a query during the tender period or clearly state their assumptions in a qualifications letter."
  },
  {
    "question": "Is a BOQ a contract document?",
    "answer": "Yes, in many traditional procurement routes, the priced BOQ forms part of the formal contract documents."
  },
  {
    "question": "Does every project need a BOQ?",
    "answer": "No. Some procurement methods, like design and build or lump-sum contracts based purely on drawings and specifications, may not require a formal client-issued BOQ."
  }
],
    relatedReading: [
  {
    "href": "/boq-vs-construction-estimate",
    "label": "BOQ vs Construction Estimate"
  },
  {
    "href": "/how-to-prepare-a-boq",
    "label": "How to Prepare a BOQ"
  },
  {
    "href": "/ai-boq-software",
    "label": "AI BOQ Software"
  }
],
    schema: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": "What Is a BOQ? A Practical Guide to Bills of Quantities",
      "description": "Learn what a Bill of Quantities is, what it contains, who prepares it, how it supports estimating and tendering, and why professional review matters.",
      "url": "https://quantara.vistabylara.com/what-is-a-boq",
      "publisher": { "@id": "https://quantara.vistabylara.com/#organization" },
      "mainEntityOfPage": { "@id": "https://quantara.vistabylara.com/#website" }
    }
  };

  return <KnowledgePage content={content} />;
}
