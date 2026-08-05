import React from "react";
import { Metadata } from "next";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export const metadata: Metadata = {
  title: "BOQ Management Software for Projects, Revisions and Templates | Quantara",
  description: "Structure BOQ sections, items, quantities, revisions and governed templates within controlled project and client workspaces using Quantara.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/boq-management",
  },
  openGraph: {
    title: "BOQ Management Software for Projects, Revisions and Templates | Quantara",
    description: "Structure BOQ sections, items, quantities, revisions and governed templates within controlled project and client workspaces using Quantara.",
    url: "https://quantara.vistabylara.com/boq-management",
    siteName: "Quantara",
  },
  twitter: {
    title: "BOQ Management Software for Projects, Revisions and Templates | Quantara",
    description: "Structure BOQ sections, items, quantities, revisions and governed templates within controlled project and client workspaces using Quantara.",
  }
};

const content: SeoLandingPageContent = {
  breadcrumbLabel: "BOQ Management",
  h1: "BOQ Management for Controlled Project Records and Revisions",
  directDefinition: "BOQ management is the systematic administration of Bill of Quantities data throughout a project lifecycle, ensuring that item hierarchies, quantities, revisions, and templates remain strictly governed and securely stored.",
  audience: {
    heading: "Who Needs Strict BOQ Management?",
    content: "Governance over project records is essential for teams handling complex or long-term construction projects.",
    items: ["Commercial Directors ensuring standardization","Project Managers tracking scope changes","Quantity Surveyors maintaining audit trails","Estimating Departments managing central templates"]
  },
  workflowProblem: {
    heading: "The Chaos of Unmanaged Data",
    paragraphs: ["When BOQs are managed as loose files on local hard drives or shared folders, governance breaks down. Different estimators use different formatting, revisions overwrite original files, and tracking the history of a specific item's quantity becomes impossible.","This lack of centralization leads to inconsistent client proposals, lost data during staff turnover, and significant difficulty in auditing project history during commercial disputes."]
  },
  quantaraSupport: {
    heading: "Centralized Control and Governance",
    paragraphs: ["Quantara solves this by enforcing a centralized, cloud-based database structure. Every project, client, and template exists within a controlled workspace. Revisions are tracked as distinct states, not just renamed files.","This structured approach ensures that everyone in the organization works from the same governed templates, and that the history of every BOQ is preserved and auditable."]
  },
  relevantFeatures: [{"name":"Project & Client Workspaces","status":"Live","description":"Organize records securely by client and project."},{"name":"Template Governance","status":"Live","description":"Enforce standard section and item formatting."},{"name":"Revision Snapshots","status":"Preview UI","description":"Capture and compare distinct versions of a BOQ."}],
  workflowExample: {
    heading: "Managing a Major Revision",
    introduction: "How a team handles a major design change mid-tender:",
    steps: [{"title":"Snapshot Original","description":"The current BOQ state is saved as a secure revision."},{"title":"Import Addendum","description":"New quantities are extracted from the client's revised documents."},{"title":"Update Structure","description":"The governed BOQ is updated with the new items and quantities."},{"title":"Compare & Review","description":"Management reviews the variance between the original and revised scope."},{"title":"Generate Update","description":"A revised proposal is generated from the controlled data."}]
  },
  supportedInputs: [{"name":"XLSX / CSV","status":"Live","description":"Standard formats for bulk data management."},{"name":"Text-based PDF","status":"Live","description":"Extracting data into the managed environment."},{"name":"Scanned PDF","status":"Live","description":"Digitizing legacy records for central storage."},{"name":"CAD / BIM","status":"Planned","description":"Future integration with managed model data.","limitation":"Capability and processing method to be confirmed after technical validation."}],
  supportedOutputs: [{"name":"Structured Database","status":"Live","description":"Secure, cloud-based relational storage."},{"name":"XLSX Export","status":"Live","description":"Exporting managed data for external use."},{"name":"PDF Generation","status":"Live","description":"Creating governed, standardized documents."}],
  limitations: ["Quantara requires users to adhere to its hierarchical structure; it is not a free-form canvas.","Governance relies on proper user management and internal company procedures.","Final commercial responsibility always remains with the human professional."],
  faqs: [{"question":"What is BOQ management?","answer":"It is the process of securely storing, structuring, revising, and standardizing Bill of Quantities data within a controlled database environment."},{"question":"Why are BOQ revisions important?","answer":"Revisions provide a critical audit trail of how a project's scope and quantities have changed over time, which is essential for commercial control."},{"question":"How should BOQ sections be structured?","answer":"They should follow a logical hierarchy (e.g., Trades, Sub-trades, Items) that aligns with industry standards or specific company templates."},{"question":"Can BOQ items be grouped?","answer":"Yes, items can be grouped into sections and subsections to create a deeply structured hierarchy."},{"question":"How are project and client records connected?","answer":"Quantara organizes data hierarchically: Clients contain Projects, and Projects contain BOQs and Proposals."},{"question":"What is template governance?","answer":"It is the ability to enforce standard layouts, section names, and formatting across all projects to ensure company-wide consistency."},{"question":"Can previous revisions be reviewed?","answer":"Yes, the system is designed to track changes so previous states can be audited."},{"question":"Who is responsible for final approval?","answer":"A qualified professional must always review and approve the managed data before it is used for any contractual purpose."}],
  relatedPages: [{"href":"/boq-software","label":"BOQ Software","description":"The core technology behind structured BOQs."},{"href":"/construction-estimating-software","label":"Estimating Software","description":"Applying managed data to commercial estimates."},{"href":"/boq-document-generation","label":"Document Generation","description":"Exporting governed data into professional formats."},{"href":"/quantity-surveying-software","label":"Quantity Surveying","description":"Software tools for QS professionals."},{"href":"/features","label":"Product Features","description":"View all Quantara management capabilities."}]
};

export default function Page() {
  return (
    <>
      <SeoLandingPage content={content} currentPath="/boq-management" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://quantara.vistabylara.com/boq-management#webpage",
                "url": "https://quantara.vistabylara.com/boq-management",
                "name": "BOQ Management Software for Projects, Revisions and Templates | Quantara",
                "description": "Structure BOQ sections, items, quantities, revisions and governed templates within controlled project and client workspaces using Quantara.",
                "isPartOf": { "@id": "https://quantara.vistabylara.com/#website" },
                "about": { "@id": "https://quantara.vistabylara.com/#organization" }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://quantara.vistabylara.com/boq-management#breadcrumb",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://quantara.vistabylara.com/"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "BOQ Management"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "@id": "https://quantara.vistabylara.com/boq-management#faq",
                "mainEntity": content.faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              }
            ]
          })
        }}
      />
    </>
  );
}
