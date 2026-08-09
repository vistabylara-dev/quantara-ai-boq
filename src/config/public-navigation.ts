import {
  PUBLIC_CAPABILITY_STATUS_LABELS,
  getPublicCapability,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";

export type NavigationItemStatus =
  (typeof PUBLIC_CAPABILITY_STATUS_LABELS)[PublicCapabilityStatus];

export interface NavigationItem {
  label: string;
  href: string;
  description?: string;
  status?: NavigationItemStatus;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export interface NavigationSection {
  label: string;
  groups: NavigationGroup[];
}

// Navigation structure matching Phase 9 requirements exactly

const googleDriveImport = getPublicCapability("google-drive-import");

export const publicNavigation: NavigationSection[] = [
  {
    label: "Platform",
    groups: [
      {
        label: "Core Platform",
        items: [
          { label: "Features", href: "/features", description: "Explore Quantara’s project, source, BOQ, revision, document and integration capabilities with clear status labels." },
          { label: "AI BOQ Software", href: "/ai-boq-software", description: "Capture supported project information for professional review and structured BOQ work." },
          { label: "BOQ Software", href: "/boq-software", description: "Organize supported BOQ records, calculations, revisions and outputs." },
          { label: "Construction Estimating Software", href: "/construction-estimating-software", description: "Organize reviewed estimating inputs and BOQ records while professionals retain pricing decisions." },
          { label: "BOQ Management", href: "/boq-management", description: "Organize sections, items, source records, distinct revisions, review steps and professional outputs." }
        ]
      },
      {
        label: "Extraction and Documents",
        items: [
          { label: "PDF BOQ Extraction", href: "/pdf-boq-extraction", description: "Extract and review supported information from text-based PDF BOQ documents." },
          { label: "Scanned PDF BOQ", href: "/scanned-pdf-boq", description: "Detect scanned and image-only PDF BOQs; OCR text extraction is not currently available." },
          { label: "BOQ Document Generation", href: "/boq-document-generation", description: "Generate professional outputs from reviewed project data." }
        ]
      },
      {
        label: "Integrations",
        items: [
          { label: "Google Drive Sources", href: "/features#google-drive-import", description: `${googleDriveImport.summary} ${googleDriveImport.limitation}`, status: PUBLIC_CAPABILITY_STATUS_LABELS[googleDriveImport.status] }
        ]
      },
      {
        label: "Professional Workflows",
        items: [
          { label: "Quantity Surveying Software", href: "/quantity-surveying-software", description: "Reviewed BOQ workflow support for quantity surveyors without replacing professional judgement." },
          { label: "Security", href: "/security", description: "Review Quantara's current authenticated-access, data-handling and Controlled Early Access security limitations." },
          { label: "About Quantara", href: "/about", description: "Learn about our mission and the team behind Quantara." }
        ]
      }
    ]
  },
  {
    label: "Solutions",
    groups: [
      {
        label: "Industries",
        items: [
          { label: "All Industries", href: "/industries", description: "Explore Quantara's industry-specific workflows." },
          { label: "Contractors", href: "/boq-software-for-contractors" },
          { label: "Quantity Surveyors", href: "/boq-software-for-quantity-surveyors" },
          { label: "MEP Contractors", href: "/boq-software-for-mep-contractors" },
          { label: "HVAC Contractors", href: "/boq-software-for-hvac-contractors" },
          { label: "Fit-Out Companies", href: "/boq-software-for-fit-out-companies" },
          { label: "Fire-Fighting Contractors", href: "/boq-software-for-fire-fighting-contractors" },
          { label: "Facilities Management", href: "/boq-software-for-facilities-management" },
          { label: "Engineering Consultants", href: "/boq-software-for-engineering-consultants" }
        ]
      }
    ]
  },
  {
    label: "Resources",
    groups: [
      {
        label: "Resource Hub",
        items: [
          { label: "Resource Centre", href: "/resources", description: "Articles, guides, and tools for construction estimating." },
          { label: "BOQ Calculation Formulas", href: "/boq-calculation-formulas" },
          { label: "Free BOQ Calculator — External Vista By Lara Tool", href: "https://www.vistabylara.com/ai-tools/boq-calculator-uae" }
        ]
      },
      {
        label: "BOQ Fundamentals",
        items: [
          { label: "What Is a BOQ?", href: "/what-is-a-boq" },
          { label: "How to Prepare a BOQ", href: "/how-to-prepare-a-boq" },
          { label: "BOQ vs Construction Estimate", href: "/boq-vs-construction-estimate" },
          { label: "BOQ vs Bill of Materials", href: "/boq-vs-bill-of-materials" }
        ]
      },
      {
        label: "Review and Control",
        items: [
          { label: "BOQ Review Checklist", href: "/boq-review-checklist" },
          { label: "Common BOQ Errors", href: "/common-boq-errors" },
          { label: "BOQ Revision Control", href: "/boq-revision-control" },
          { label: "Review an AI-Extracted BOQ", href: "/how-to-review-ai-extracted-boq" }
        ]
      },
      {
        label: "PDF and OCR",
        items: [
          { label: "Convert PDF BOQ to Excel", href: "/how-to-convert-pdf-boq-to-excel" },
          { label: "Text PDF vs Scanned PDF", href: "/text-pdf-vs-scanned-pdf" },
          { label: "OCR for BOQ Documents", href: "/ocr-for-boq-documents" }
        ]
      },
      {
        label: "Workflow Categories",
        items: [
          { label: "Quantity Takeoff vs BOQ Management", href: "/quantity-takeoff-vs-boq-management" }
        ]
      }
    ]
  },
  {
    label: "Comparisons",
    groups: [
      {
        label: "Comparisons",
        items: [
          { label: "Comparison Hub", href: "/comparisons" },
          { label: "Quantara vs Excel for BOQ", href: "/quantara-vs-excel-for-boq" },
          { label: "BOQ Software vs Spreadsheets", href: "/boq-software-vs-spreadsheets" },
          { label: "AI BOQ vs Manual BOQ Preparation", href: "/ai-boq-vs-manual-boq-preparation" },
          { label: "OCR vs Structured BOQ Extraction", href: "/ocr-vs-structured-boq-extraction" },
          { label: "Quantity Takeoff vs BOQ Software", href: "/quantity-takeoff-vs-boq-software" },
          { label: "BOQ Software vs Document Management", href: "/boq-software-vs-document-management" },
          { label: "Construction Estimating Software vs Excel", href: "/construction-estimating-software-vs-excel" },
          { label: "When to Use BOQ Software", href: "/when-to-use-boq-software" }
        ]
      }
    ]
  },
  {
    label: "Regional",
    groups: [
      {
        label: "Middle East",
        items: [
          { label: "GCC BOQ Software", href: "/gcc-boq-software" },
          { label: "UAE", href: "/boq-software-uae" },
          { label: "Dubai", href: "/boq-software-dubai" },
          { label: "Abu Dhabi", href: "/boq-software-abu-dhabi" },
          { label: "UAE Construction Estimating", href: "/construction-estimating-software-uae" },
          { label: "UAE MEP Estimating", href: "/mep-estimating-software-uae" },
          { label: "Saudi Arabia", href: "/boq-software-saudi-arabia" },
          { label: "Qatar", href: "/boq-software-qatar" },
          { label: "Oman", href: "/boq-software-oman" }
        ]
      }
    ]
  },
  {
    label: "Company",
    groups: [
      {
        label: "Company",
        items: [
          { label: "About", href: "/about" },
          { label: "Pricing", href: "/pricing" },
          { label: "Contact Sales", href: "/contact-sales" },
          { label: "Request Early Access", href: "/register" },
          { label: "Security", href: "/security" }
        ]
      }
    ]
  }
];

export const legalNavigation: NavigationItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Data Processing", href: "/data-processing" },
  { label: "Acceptable Use", href: "/acceptable-use" },
  { label: "Subprocessors", href: "/subprocessors" }
];
