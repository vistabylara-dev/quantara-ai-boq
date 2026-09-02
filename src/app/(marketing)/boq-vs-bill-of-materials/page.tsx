import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata, PUBLIC_CONTENT_REVIEW_DATE } from "@/lib/public-site/search-registry";
import KnowledgePage, { KnowledgePageContent } from "@/components/layout/knowledge-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/boq-vs-bill-of-materials", locale);
}



export default function Page() {
  const content: KnowledgePageContent = {
    breadcrumbLabel: "BOQ vs Bill of Materials",
    title: "BOQ vs Bill of Materials: Purpose, Structure and Use",
    summary: "A Bill of Quantities (BOQ) and a Bill of Materials (BOM) are often confused, but they serve different industries and phases of a project. A BOQ is a construction document detailing the labor, materials, and methodology required to complete works. A BOM is a manufacturing or procurement document that lists only the physical parts and raw materials required to assemble a product.",
    reviewedDate: PUBLIC_CONTENT_REVIEW_DATE,
    sections: [
  {
    "id": "why-it-matters",
    "heading": "Why the Distinction Matters",
    "paragraphs": [
      "For MEP teams, fit-out contractors and procurement managers, understanding when to use a BOQ versus a BOM helps teams distinguish and check material, labor and installation cost categories.",
      "A BOM tells you what to buy. A BOQ tells you what to buy, how to install it, and what the overall construction activity entails."
    ]
  },
  {
    "id": "core-differences",
    "heading": "Work Items vs Material Components",
    "bullets": [
      "Scope: A BOQ item (e.g., \"Construct 200mm block wall\") includes the blocks, the mortar, the labor to lay them, and the equipment. A BOM lists only the pallets of blocks and bags of cement.",
      "Context: BOMs originate in manufacturing and engineering. BOQs are specific to civil engineering and construction.",
      "Procurement: A BOM is handed to a supplier to buy parts. A BOQ is handed to a subcontractor to perform work."
    ]
  },
  {
    "id": "comparison-table",
    "heading": "Side-by-Side Comparison",
    "table": {
      "headers": [
        "Feature",
        "Bill of Quantities (BOQ)",
        "Bill of Materials (BOM)"
      ],
      "rows": [
        [
          "Primary Focus",
          "Completed construction activities",
          "Raw materials and physical parts"
        ],
        [
          "Includes Labor?",
          "Yes, labor is priced into the rate",
          "No, only material costs"
        ],
        [
          "Industry",
          "Construction, Civil Engineering, MEP",
          "Manufacturing, Product Assembly, Supply Chain"
        ],
        [
          "Measurement",
          "Finished work (e.g., square meters of wall)",
          "Raw inputs (e.g., number of bricks)"
        ]
      ]
    }
  },
  {
    "id": "practical-example",
    "heading": "A Practical Example",
    "paragraphs": [
      "Consider a hypothetical lighting installation package.",
      "The BOQ entry: \"Supply, install, and commission 600x600 LED panel lights in suspended ceiling (Qty: 50).\"",
      "The BOM entry for that exact same package: \"600x600 LED Light Fixtures (Qty: 50), Driver units (Qty: 50), 2.5mm twin and earth cable (Qty: 200m), Mounting brackets (Qty: 200).\""
    ]
  },
  {
    "id": "limitations",
    "heading": "Limitations and Overlap",
    "paragraphs": [
      "Some specialized construction contractors (like steel fabricators or modular builders) use both. They use a BOQ to win the contract with the client, and then they generate a BOM for their factory to actually build the components.",
      "Treating a BOM as a BOQ is dangerous because it ignores the significant costs of labor, site management, plant hire, and installation complexity."
    ]
  },
  {
    "id": "quantara-workflow",
    "heading": "How Quantara Supports the Workflow",
    "paragraphs": [
      "Quantara is AI-assisted BOQ workflow software. It captures supported project information for review and organizes confirmed work items, revisions and project records.",
      "Quantara supports BOQ records and professional outputs; it is not a manufacturing BOM or inventory-management system."
    ]
  }
],
    faqs: [
  {
    "question": "Can a BOQ be converted into a BOM?",
    "answer": "Yes, but it requires an estimator or engineer to break down the BOQ \"work items\" into their constituent raw materials and remove the labor elements."
  },
  {
    "question": "Do MEP contractors use a BOM or a BOQ?",
    "answer": "MEP contractors typically price a BOQ to win a project, but their procurement team will generate a BOM to order the specific pipes, cables, and valves from suppliers."
  },
  {
    "question": "Does a BOM include waste?",
    "answer": "Yes, a practical BOM usually includes a waste factor for materials, whereas a BOQ usually lists \"net\" quantities of the finished work."
  },
  {
    "question": "Are quantities the same in a BOQ and BOM?",
    "answer": "Rarely. A BOQ might measure a wall in square meters, while the corresponding BOM measures the bricks, mortar, and ties individually."
  },
  {
    "question": "Which document is a contract document?",
    "answer": "In construction, the priced BOQ is typically part of the contract. The BOM is usually an internal procurement document."
  }
],
    relatedReading: [
  {
    "href": "/what-is-a-boq",
    "label": "What Is a BOQ?"
  },
  {
    "href": "/boq-management",
    "label": "BOQ Management"
  },
  {
    "href": "/boq-software",
    "label": "BOQ Software"
  }
],
    path: "/boq-vs-bill-of-materials"
  };

  return <KnowledgePage content={content} />;
}
