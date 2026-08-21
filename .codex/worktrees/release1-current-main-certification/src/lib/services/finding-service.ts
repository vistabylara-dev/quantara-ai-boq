import { prisma } from "@/lib/db/prisma";
import { CorrectiveActionType, RootCauseCategory, RiskUrgency } from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { NotFoundError } from "@/lib/errors/app-error";
import { getInspectionRecord } from "@/lib/services/inspection-service";

export type CreateFindingInput = {
  title: string;
  description: string;
  observedCondition?: string;
  expectedCondition?: string;
  severity?: string;
  location?: string;
};

export async function createFinding(actor: CurrentActor, inspectionId: string, input: CreateFindingInput) {
  requireCapability(actor, "verification:manage");
  const inspection = await getInspectionRecord(actor, inspectionId);
  const findingNumber = (inspection.findings?.length ?? 0) + 1;

  return prisma.inspectionFinding.create({
    data: {
      companyId: actor.companyId,
      inspectionId,
      findingNumber,
      title: input.title,
      description: input.description,
      observedCondition: input.observedCondition,
      expectedCondition: input.expectedCondition,
      severity: input.severity ?? "MEDIUM",
      location: input.location,
      status: "DRAFT",
      createdByType: "HUMAN",
      createdByUserId: actor.userId,
    },
  });
}

export async function confirmFinding(actor: CurrentActor, findingId: string) {
  requireCapability(actor, "verification:manage");
  const finding = await prisma.inspectionFinding.findFirst({ where: { id: findingId, companyId: actor.companyId } });
  if (!finding) throw new NotFoundError("Finding not found.");
  return prisma.inspectionFinding.update({ where: { id: findingId }, data: { status: "CONFIRMED", confirmedByUserId: actor.userId, confirmedAt: new Date() } });
}

export type CreateRootCauseInput = { method: string; primaryCauseCategory: string; conclusion?: string; furtherTestingRequired?: boolean };

export async function addRootCauseAnalysis(actor: CurrentActor, findingId: string, input: CreateRootCauseInput) {
  requireCapability(actor, "verification:manage");
  const finding = await prisma.inspectionFinding.findFirst({ where: { id: findingId, companyId: actor.companyId } });
  if (!finding) throw new NotFoundError("Finding not found.");
  return prisma.rootCauseAnalysis.create({
    data: {
      companyId: actor.companyId,
      inspectionFindingId: findingId,
      method: input.method,
      primaryCauseCategory: input.primaryCauseCategory as RootCauseCategory,
      conclusion: input.conclusion,
      furtherTestingRequired: input.furtherTestingRequired ?? false,
      status: "EXTRACTED",
      createdByUserId: actor.userId,
    },
  });
}

export type CreateRiskInput = { likelihood: number; severity: number; recommendedUrgency: string; rationale?: string };

const RISK_LEVEL_THRESHOLDS: Array<{ max: number; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }> = [
  { max: 4, level: "LOW" },
  { max: 9, level: "MEDIUM" },
  { max: 14, level: "HIGH" },
  { max: 25, level: "CRITICAL" },
];

function riskLevelForScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  return RISK_LEVEL_THRESHOLDS.find((t) => score <= t.max)?.level ?? "CRITICAL";
}

export async function addRiskAssessment(actor: CurrentActor, findingId: string, input: CreateRiskInput) {
  requireCapability(actor, "verification:manage");
  const finding = await prisma.inspectionFinding.findFirst({ where: { id: findingId, companyId: actor.companyId } });
  if (!finding) throw new NotFoundError("Finding not found.");

  if (input.likelihood < 1 || input.likelihood > 5 || input.severity < 1 || input.severity > 5) {
    throw new Error("likelihood and severity must each be between 1 and 5.");
  }
  const riskScore = input.likelihood * input.severity;

  return prisma.riskAssessment.create({
    data: {
      companyId: actor.companyId,
      inspectionFindingId: findingId,
      likelihood: input.likelihood,
      severity: input.severity,
      riskScore,
      riskLevel: riskLevelForScore(riskScore),
      recommendedUrgency: input.recommendedUrgency as RiskUrgency,
      rationale: input.rationale,
      status: "EXTRACTED",
      assessedByUserId: actor.userId,
    },
  });
}

export type CreateCorrectiveActionInput = { actionType: string; title: string; description?: string; priority?: string };

export async function addCorrectiveAction(actor: CurrentActor, findingId: string, input: CreateCorrectiveActionInput) {
  requireCapability(actor, "verification:manage");
  const finding = await prisma.inspectionFinding.findFirst({ where: { id: findingId, companyId: actor.companyId } });
  if (!finding) throw new NotFoundError("Finding not found.");
  return prisma.correctiveAction.create({
    data: {
      companyId: actor.companyId,
      inspectionFindingId: findingId,
      actionType: input.actionType as CorrectiveActionType,
      title: input.title,
      description: input.description,
      priority: input.priority ?? "MEDIUM",
      status: "EXTRACTED",
      createdByUserId: actor.userId,
    },
  });
}

export async function confirmCorrectiveAction(actor: CurrentActor, actionId: string) {
  requireCapability(actor, "verification:manage");
  const action = await prisma.correctiveAction.findFirst({ where: { id: actionId, companyId: actor.companyId } });
  if (!action) throw new NotFoundError("Corrective action not found.");
  return prisma.correctiveAction.update({ where: { id: actionId }, data: { status: "CONFIRMED", confirmedByUserId: actor.userId } });
}
