import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export const metadata = createPublicPageMetadata("/boq-vs-construction-estimate");



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "BOQ vs Construction Estimate",
    title: "BOQ vs Construction Estimate: What Is the Difference?",
    summary: "While both a Bill of Quantities (BOQ) and a construction estimate deal with the costs and scope of a project, they serve different purposes. A BOQ is typically a formal tender document defining exact quantities for contractors to price, whereas an estimate is an internal calculation of costs, overheads, margins, and risk used to determine a final bid or project budget.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why the Distinction Matters",
    "paragraphs": [
      "For contractors, estimators, and commercial teams, understanding the boundary between a BOQ and an estimate is critical for managing risk and profitability.",
      "A client issues a BOQ to tell contractors exactly what to price. The contractor then builds an internal estimate to figure out how much those items will actually cost them to deliver, factoring in labor productivity, material waste, subcontractor quotes, and company overheads."
    ]
  },
  {
    "id": "core-differences",
    "heading": "Structure and Purpose",
    "paragraphs": [
      "The fundamental differences lie in their audience and granularity:"
    ],
    "bullets": [
      "Audience: A BOQ is an external, shared document between client and contractor. An estimate is a confidential, internal document.",
      "Rates: The BOQ contains a single \"sell rate\" per item. The estimate breaks that rate down into labor, plant, materials, and subcontractor costs.",
      "Risk: The BOQ lists net quantities. The estimate includes waste factors, contingencies, and overhead allocations."
    ]
  },
  {
    "id": "comparison-table",
    "heading": "Comparison Overview",
    "table": {
      "headers": [
        "Feature",
        "Bill of Quantities (BOQ)",
        "Construction Estimate"
      ],
      "rows": [
        [
          "Primary User",
          "Client, Quantity Surveyor, Bidding Contractor",
          "Internal Estimating Team, Commercial Manager"
        ],
        [
          "Purpose",
          "Standardized tendering and valuation",
          "Calculating actual costs and determining a bid price"
        ],
        [
          "Visibility",
          "Shared between contracting parties",
          "Strictly confidential and internal"
        ],
        [
          "Rate Structure",
          "Single consolidated unit rate (Sell Rate)",
          "Detailed breakdown (Cost + Margin + Overhead)"
        ]
      ]
    }
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "In a hypothetical HVAC package, the BOQ might list \"Supply and install 150mm ductwork (100 linear meters).\"",
      "The estimator takes that BOQ item and builds an estimate: 105 meters of material (allowing 5% waste), 3 days of labor for a two-person team, scaffold hire costs, and a 10% profit margin. All these internal calculations are rolled up into a single rate that is inserted back into the BOQ."
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations and Overlap",
    "paragraphs": [
      "In practice, terminology varies by region. Some contractors refer to their priced BOQ as their estimate. However, treating the BOQ as your only estimating tool—without building a proper cost buildup behind the scenes—is a major commercial risk.",
      "Assumptions and exclusions must be clearly tracked as data moves from the internal estimate to the external BOQ submission."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports Estimating Workflows",
    "paragraphs": [
      "Quantara captures supported BOQ information from text-based PDFs and spreadsheets into a review workflow. Coverage, correction effort and review time depend on the source.",
      "Confirmed information can be organized in BOQ records and exported for further estimating work. Estimate accuracy remains dependent on professional quantities, rates and assumptions."
    ]
  }
],
    faqs: [
  {
    "question": "Is a BOQ the same as an estimate?",
    "answer": "No. A BOQ is a list of measured items and quantities to be priced. An estimate is the detailed internal calculation of how much those items will cost."
  },
  {
    "question": "Do you need a BOQ to create an estimate?",
    "answer": "Not necessarily. An estimate can be created directly from drawings and specifications by performing a quantity takeoff internally, without a client-issued BOQ."
  },
  {
    "question": "Does an estimate become a BOQ?",
    "answer": "Once an estimate is finalized, the resulting unit rates and totals are often transferred into a BOQ format for submission to the client."
  },
  {
    "question": "Should overhead and profit be in the BOQ?",
    "answer": "In most standard BOQs, overhead and profit are distributed proportionally into the item unit rates, though some formats have specific lines for preliminary and general costs."
  },
  {
    "question": "What happens if the BOQ quantities are wrong?",
    "answer": "Depending on the contract type, incorrect BOQ quantities might be the client's risk (in a remeasured contract) or the contractor's risk (if the contractor was required to verify them)."
  }
],
    relatedReading: [
  {
    "href": "/what-is-a-boq",
    "label": "What Is a BOQ?"
  },
  {
    "href": "/quantity-takeoff-vs-boq-management",
    "label": "Quantity Takeoff vs BOQ Management"
  },
  {
    "href": "/construction-estimating-software",
    "label": "Construction Estimating Software"
  }
],
    path: "/boq-vs-construction-estimate"
  };

  return <KnowledgePage content={content} />;
}
