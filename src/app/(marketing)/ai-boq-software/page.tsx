import { getServerLocale } from "@/lib/i18n/server-locale";
import { createPublicPageMetadata } from "@/lib/public-site/search-registry";
import React from "react";
import Link from "next/link";
import SeoLandingPage, { SeoLandingPageContent } from "@/components/layout/seo-landing-page";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return createPublicPageMetadata("/ai-boq-software", locale);
}

const content: SeoLandingPageContent = {
  breadcrumbLabel: "AI BOQ Software",
  h1: "AI-Assisted BOQ Measurement & Quantity Calculation Software",
  directDefinition:
    "Quantara brings project sources, reviewable extraction, guided measurement, deterministic quantity calculations and professional BOQ workflows together in one controlled platform. Review source-linked or professionally entered dimensions, see the engineering equation and calculated quantity, and confirm the result into your BOQ workflow.",
  audience: {
    heading: "Who Uses AI BOQ Software?",
    content:
      "Quantara is built for contractors, estimators, quantity surveyors, consultants and specialist teams that need controlled construction records and professional review.",
    items: [
      "Contractors managing multiple tender submissions",
      "Estimators preparing supported measurement and calculation workflows",
      "Quantity surveyors reviewing extracted information and calculated quantities",
      "MEP teams organizing specialized BOQ disciplines",
    ],
  },
  workflowProblem: {
    heading: "The Challenge of Manual BOQ Workflows",
    paragraphs: [
      <>
        Construction teams often move information between drawings, schedules, PDFs and spreadsheets before they can prepare a BOQ. Quantara combines review-led extraction, guided measurement and controlled BOQ structuring so the professional can review each result before it is used. Teams can compare{" "}
        <Link href="/ai-boq-vs-manual-boq-preparation" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          AI-assisted and manual BOQ preparation
        </Link>{" "}
        before choosing a workflow.
      </>,
      <>
        <Link href="/ocr-vs-structured-boq-extraction" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          Basic OCR tools
        </Link>{" "}
        recognize image text but do not by themselves establish a BOQ hierarchy or verify measurement inputs. Captured content, dimensions and quantities still require professional review.
      </>,
    ],
  },
  quantaraSupport: {
    heading: "How Quantara Supports the Workflow",
    paragraphs: [
      "Quantara supports review-led extraction from supported sources, then lets professionals review source-linked dimensions where available or enter and correct the required dimensions for supported calculation types. It applies deterministic engineering formulas, displays the equation and calculated quantity, and requires professional confirmation before governed BOQ use.",
      "In supported BOQ contexts, voice can enter or correct measurements and propose supported item changes for review. Through controlled access, Autodesk / AutoCAD DWG analysis can turn selected DWG model metadata and properties into traceable review candidates. Quantara also supports structured BOQ management and professional outputs from reviewed project data.",
    ],
  },
  relevantFeatures: [
    {
      name: "Reviewed extraction",
      capabilityId: "reviewed-extraction",
      description: "Confirm, correct or reject supported extracted information before later BOQ use.",
    },
    {
      name: "Guided BOQ measurement and quantity calculations",
      capabilityId: "visible-calculations",
      description: "Use reviewed source-linked or professionally entered dimensions with deterministic formulas, visible equations and calculated quantities.",
    },
    {
      name: "Voice-assisted measurement and BOQ editing",
      capabilityId: "voice-proposals",
      description: "Use voice to enter or correct supported measurements and propose supported BOQ changes for confirmation.",
    },
    {
      name: "Autodesk / AutoCAD DWG analysis",
      capabilityId: "autodesk-dwg-analysis",
      description: "Create traceable review candidates from selected Autodesk DWG model metadata and properties.",
    },
    {
      name: "Structured BOQ management",
      capabilityId: "boq-management",
      description: "Organize confirmed items into hierarchical BOQ sections, trades and revisions.",
    },
    {
      name: "Professional project outputs",
      capabilityId: "professional-outputs",
      description: "Generate supported BOQ documents and project outputs from reviewed project data.",
    },
  ],
  workflowExample: {
    heading: "Practical AI BOQ Measurement Workflow",
    introduction: "A controlled workflow for moving from project sources to professional output:",
    steps: [
      {
        title: "Upload / Connect Source",
        description: "Add a supported project source or connect an authorized source account where enabled.",
      },
      {
        title: "Supported Extraction",
        description: "Create supported review candidates from extractable source data or supported Autodesk DWG model metadata and properties.",
      },
      {
        title: "Human Review",
        description: "Verify, correct or reject relevant information against the source before it is used in the BOQ workflow.",
      },
      {
        title: "Guided Measurement",
        description: "Review source-linked dimensions where available, or enter and correct the dimensions required for a supported calculation type.",
      },
      {
        title: "Quantity Calculation",
        description: "Apply the supported deterministic engineering formula and inspect the visible equation and calculated quantity.",
      },
      {
        title: "BOQ Structuring",
        description: "Confirm reviewed items into governed BOQ sections, quantities, units and revisions.",
      },
      {
        title: "Professional Output",
        description: "Generate supported outputs from reviewed project records and templates.",
      },
    ],
  },
  supportedInputs: [
    {
      name: "Text-based PDF",
      capabilityId: "text-pdf-extraction",
      description: "Supported PDFs with selectable text and reviewable table content.",
    },
    {
      name: "Scanned/Image-Only PDF - Detection",
      capabilityId: "scanned-pdf-detection",
      description: "Detects image-only pages and reports that text extraction is unavailable.",
      limitation: "Quantara does not provide OCR; manual transcription is required.",
    },
    {
      name: "Scanned/Image-Only PDF - OCR",
      capabilityId: "scanned-pdf-ocr",
      description: "Automated text recognition for image-based documents is not currently implemented.",
      limitation: "Scanned documents require manual transcription.",
    },
    {
      name: "XLSX / CSV",
      capabilityId: "spreadsheet-import",
      description: "Supported structured spreadsheet formats, subject to mapping and review.",
    },
    {
      name: "Autodesk / AutoCAD DWG analysis",
      capabilityId: "autodesk-dwg-analysis",
      description: "Controlled-access analysis of supported Autodesk DWG files for traceable review candidates.",
    },
    {
      name: "Generic CAD / BIM / IFC model quantity extraction",
      capabilityId: "model-file-import",
      description: "Generic model quantity extraction is not claimed and is distinct from supported Autodesk DWG analysis.",
    },
  ],
  supportedOutputs: [
    {
      name: "XLSX Export",
      capabilityId: "professional-outputs",
      description: "Structured spreadsheet output for further professional use.",
    },
    {
      name: "PDF Generation",
      capabilityId: "professional-outputs",
      description: "Reviewable documents generated from stored data and available templates.",
    },
    {
      name: "Technical Reports",
      capabilityId: "technical-report-generation",
      description: "DOCX technical reports generated from reviewed project records and templates in supported configured environments.",
    },
  ],
  limitations: [
    "Quantara does not automatically determine final project costs.",
    "Quantara does not make a blanket claim of fully unattended computer-vision takeoff that derives final quantities from arbitrary drawing geometry without professional review.",
    "Supported calculation types require the applicable dimensions, professional review and confirmation; missing dimensions are not fabricated.",
  ],
  faqs: [
    {
      question: "What is AI BOQ software?",
      answer: "AI BOQ software helps construction professionals capture, review, measure, calculate and organize supported project information into controlled BOQ workflows.",
    },
    {
      question: "Can AI create a BOQ?",
      answer: "AI can assist with supported extraction, guided measurement, deterministic quantity calculation and BOQ structuring, but a qualified professional must review, refine and approve the final BOQ.",
    },
    {
      question: "Can AI read scanned BOQ files?",
      answer: "Not yet. Quantara detects scanned or image-based PDFs and flags them as requiring OCR, but OCR text recognition is not currently available. Scanned content currently requires manual transcription.",
    },
    {
      question: "Can Quantara measure and calculate BOQ quantities?",
      answer: "Yes. For supported calculation types, Quantara provides a guided BOQ measurement workflow. It works with reviewed source-linked or professionally entered dimensions, applies deterministic engineering formulas, displays the equation and calculated quantity, and allows the responsible professional to confirm the result before it is applied to governed BOQ data.",
    },
    {
      question: "Is AI BOQ software the same as quantity takeoff software?",
      answer: "Quantara provides guided measurement and deterministic quantity calculation for supported calculation types within a review-led BOQ workflow. It does not make a blanket claim of fully unattended computer-vision takeoff from arbitrary drawing geometry without professional review.",
    },
    {
      question: "Can I use voice for BOQ measurement and editing?",
      answer: "Yes. In supported BOQ contexts, voice can enter or correct measurements and propose supported item changes. Each change remains subject to professional review and user confirmation before it is applied to governed project data.",
    },
    {
      question: "Can Quantara analyze Autodesk DWG files?",
      answer: "Yes, through controlled access. Quantara can analyze supported Autodesk / AutoCAD DWG files and create traceable review candidates from model metadata and properties for professional review.",
    },
    {
      question: "Can AI replace a quantity surveyor?",
      answer: "No. Quantara supports quantity surveyors with reviewed extraction, guided measurement, calculation visibility and structured workflows; it does not replace professional judgment, commercial context or strategic decision-making.",
    },
    {
      question: "How should AI-assisted quantities be reviewed?",
      answer: "The responsible professional must verify source information, required dimensions, equations, calculated quantities, units, assumptions and final commercial totals before issue.",
    },
    {
      question: "Which files can Quantara currently process?",
      answer: "Quantara supports text-based PDFs, XLSX and CSV files. Through controlled access, it can analyze supported Autodesk DWG files. Scanned or image-only PDFs are detected and flagged as requiring OCR, but OCR text extraction is not currently available.",
    },
  ],
  relatedPages: [
    {
      href: "/boq-software",
      label: "BOQ Software",
      description: "Learn about structured BOQ management and revisions.",
    },
    {
      href: "/pdf-boq-extraction",
      label: "PDF BOQ Extraction",
      description: "Deep dive into processing text-based PDF documents.",
    },
    {
      href: "/scanned-pdf-boq",
      label: "Scanned PDF Processing",
      description: "How Quantara detects image-based documents today and the current OCR limitation.",
    },
    {
      href: "/boq-management",
      label: "BOQ Management",
      description: "Controlling project records and templates.",
    },
    {
      href: "/features",
      label: "Product Features",
      description: "View the complete list of available and unavailable capabilities.",
    },
  ],
};

export default function Page() {
  return <SeoLandingPage content={content} currentPath="/ai-boq-software" />;
}
