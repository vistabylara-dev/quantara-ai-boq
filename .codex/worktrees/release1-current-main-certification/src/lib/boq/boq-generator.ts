import { calculateTotals } from "@/lib/calculations/boq-totals";
import type { BOQ, BOQSection } from "@/types/boq";
import type { IndustryEngine } from "@/types/industry";
import type { Project } from "@/types/project";

function formatRevision(number: number): string {
  return `R${String(number).padStart(2, "0")}`;
}

export function createDefaultBOQ(project: Project, industry: IndustryEngine): BOQ {
  const sections: BOQSection[] = industry.boqSections.map((section) => ({
    ...section,
    items: [],
    collapsed: false,
  }));

  return {
    id: `boq-${project.id}-${industry.id}-R01`,
    projectId: project.id,
    title: `${industry.name} BOQ`,
    revision: "R01",
    status: "draft",
    sections,
    totals: calculateTotals([], 0, project.taxRate),
    createdAt: new Date().toISOString(),
    lockedAt: undefined,
    approvedBy: undefined,
  };
}

export function createRevisionBOQ(currentBOQ: BOQ): BOQ {
  const existingRevisionNumber = Number(currentBOQ.revision.replace(/^R/, "")) || 1;
  const nextRevision = formatRevision(existingRevisionNumber + 1);
  const id = currentBOQ.id.match(/-R\d+$/)
    ? currentBOQ.id.replace(/-R\d+$/, `-${nextRevision}`)
    : `${currentBOQ.id}-${nextRevision}`;
  const taxRate = currentBOQ.totals.taxableAmount > 0 ? (currentBOQ.totals.taxAmount / currentBOQ.totals.taxableAmount) * 100 : 0;
  const newBOQ: BOQ = {
    ...currentBOQ,
    id,
    revision: nextRevision,
    status: "draft",
    createdAt: new Date().toISOString(),
    lockedAt: undefined,
    approvedBy: undefined,
    totals: calculateTotals(currentBOQ.sections.flatMap((section) => section.items), currentBOQ.totals.discountPercentage, taxRate),
  };
  return newBOQ;
}
