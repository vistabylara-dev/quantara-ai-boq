import type { MetricCard, PhaseItem, ProjectRow } from "@/types/dashboard";

export const metricCards: MetricCard[] = [
  {
    label: "Active Projects",
    value: "18",
    trend: "+12% this month",
    state: "normal",
  },
  {
    label: "BOQs in Review",
    value: "6",
    trend: "4 pending approvals",
    state: "warning",
  },
  {
    label: "Extraction Confidence",
    value: "93%",
    trend: "Stable performance",
    state: "success",
  },
  {
    label: "Client Approvals",
    value: "82%",
    trend: "2 overdue reviews",
    state: "danger",
  },
];

export const phaseItems: PhaseItem[] = [
  {
    title: "Phase 1: Foundation",
    status: "active",
    description: "Core dashboard shell and enterprise workspace UI.",
  },
  {
    title: "Phase 2: Company Workspace",
    status: "locked",
    description: "Shared workspace and organization-level settings.",
  },
  {
    title: "Phase 3: BOQ Studio",
    status: "locked",
    description: "BOQ authoring, editing, and review tools.",
  },
  {
    title: "Phase 4: File Extraction",
    status: "locked",
    description: "Automated quantity extraction from documents.",
  },
  {
    title: "Phase 5: Drawing Intelligence",
    status: "locked",
    description: "Advanced drawing recognition and tagging.",
  },
  {
    title: "Phase 6: Verification",
    status: "locked",
    description: "Verification workflows and audit traceability.",
  },
  {
    title: "Phase 7: Export & Client Portal",
    status: "locked",
    description: "Export workflows and secure client access.",
  },
];

export const recentProjects: ProjectRow[] = [
  {
    name: "Eastern Gateway Tower",
    projectId: "QBOQ-2047",
    stage: "Review",
    confidence: "91%",
    status: "Awaiting signoff",
    updated: "2h ago",
  },
  {
    name: "Riverside Logistics Park",
    projectId: "QBOQ-2183",
    stage: "Extraction",
    confidence: "88%",
    status: "In progress",
    updated: "5h ago",
  },
  {
    name: "Southport Medical Campus",
    projectId: "QBOQ-2015",
    stage: "Validation",
    confidence: "95%",
    status: "Ready for approval",
    updated: "1d ago",
  },
  {
    name: "Harborview Office Complex",
    projectId: "QBOQ-2120",
    stage: "Planning",
    confidence: "84%",
    status: "Review schedule",
    updated: "2d ago",
  },
];
