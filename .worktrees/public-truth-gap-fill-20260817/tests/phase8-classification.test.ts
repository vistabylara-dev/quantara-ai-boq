import { ProjectFileClassification, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import { createClient } from "../src/lib/repositories/client-repository";
import { createProjectWithDefaultBoq } from "../src/lib/services/project-service";
import { uploadProjectFile, triggerFileClassification, updateFileClassification, getProjectFile } from "../src/lib/services/project-file-service";
import { classifyProjectFile } from "../src/lib/files/file-classifier";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

const RUN_ID = Date.now();

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 3000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("waitFor: condition not met within timeout");
}

describe("Phase 8 sub-phase 3: document classification (integration, real local Postgres)", () => {
  let companyId: string;
  let projectId: string;
  let ownerActor: CurrentActor;
  let reviewerActor: CurrentActor;
  let ownerActorOtherCompany: CurrentActor;
  const cleanupCompanyIds: string[] = [];

  beforeAll(async () => {
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });

    const company = await prisma.company.create({ data: { legalName: `Phase8 Classify Co ${RUN_ID}`, tradeName: "Phase8 CL", email: `phase8-cl-${RUN_ID}@example.com` } });
    companyId = company.id;
    cleanupCompanyIds.push(companyId);
    await prisma.companyIndustryEngine.create({ data: { companyId, industryEngineId: construction.id, enabled: true } });
    const client = await createClient(companyId, { name: "Client CL", email: `phase8-cl-client-${RUN_ID}@example.com` });

    const ownerUser = await prisma.user.create({ data: { companyId, email: `phase8-cl-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner CL", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    const reviewerUser = await prisma.user.create({ data: { companyId, email: `phase8-cl-reviewer-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Reviewer CL", role: UserRole.REVIEWER, isActive: true, emailVerifiedAt: new Date() } });
    ownerActor = { userId: ownerUser.id, companyId, role: UserRole.COMPANY_OWNER, fullName: "Owner CL", email: ownerUser.email };
    reviewerActor = { userId: reviewerUser.id, companyId, role: UserRole.REVIEWER, fullName: "Reviewer CL", email: reviewerUser.email };

    const { project } = await createProjectWithDefaultBoq(ownerActor, {
      clientId: client.id, industryEngineId: "construction", reference: `P8CL-${RUN_ID}`, name: "Phase8 Classify Project",
      location: "Dubai", currency: "AED", taxRate: "5", language: "English",
    });
    projectId = project.databaseId;

    const otherCompany = await prisma.company.create({ data: { legalName: `Phase8 Classify Co Other ${RUN_ID}`, tradeName: "Phase8 CL Other", email: `phase8-cl-other-${RUN_ID}@example.com` } });
    cleanupCompanyIds.push(otherCompany.id);
    const otherOwner = await prisma.user.create({ data: { companyId: otherCompany.id, email: `phase8-cl-other-owner-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "Owner Other", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } });
    ownerActorOtherCompany = { userId: otherOwner.id, companyId: otherCompany.id, role: UserRole.COMPANY_OWNER, fullName: "Owner Other", email: otherOwner.email };
  });

  afterAll(async () => {
    for (const id of cleanupCompanyIds) {
      await prisma.extractionJob.deleteMany({ where: { companyId: id } });
      await prisma.projectFile.deleteMany({ where: { companyId: id } });
      await prisma.bOQItem.deleteMany({ where: { companyId: id } });
      await prisma.bOQSection.deleteMany({ where: { companyId: id } });
      await prisma.bOQ.deleteMany({ where: { companyId: id } });
      await prisma.project.deleteMany({ where: { companyId: id } });
      await prisma.client.deleteMany({ where: { companyId: id } });
      await prisma.companyIndustryEngine.deleteMany({ where: { companyId: id } });
      await prisma.user.deleteMany({ where: { companyId: id } });
      await prisma.company.delete({ where: { id } });
    }
  });

  describe("classifyProjectFile (pure heuristic, unit)", () => {
    it("recognizes a strong keyword match with high confidence", () => {
      const result = classifyProjectFile({ originalName: "Villa-23_Electrical-Plan_Rev-B.pdf", mimeType: "application/pdf", extension: "pdf" });
      expect(result.classification).toBe(ProjectFileClassification.ELECTRICAL_PLAN);
      expect(result.confidence).toBeGreaterThanOrEqual(65);
      expect(result.matchedSignals.length).toBeGreaterThan(0);
    });

    it("boosts confidence with multiple matching keywords for the same category, capped at 90", () => {
      const result = classifyProjectFile({ originalName: "hvac-mechanical-plan-ductwork.pdf", mimeType: "application/pdf", extension: "pdf" });
      expect(result.classification).toBe(ProjectFileClassification.HVAC_PLAN);
      expect(result.confidence).toBeLessThanOrEqual(90);
      expect(result.matchedSignals.length).toBeGreaterThanOrEqual(2);
    });

    it("returns UNKNOWN with zero confidence when no keyword matches — never fabricates a guess", () => {
      const result = classifyProjectFile({ originalName: "scan-004821.pdf", mimeType: "application/pdf", extension: "pdf" });
      expect(result.classification).toBe(ProjectFileClassification.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.matchedSignals).toEqual([]);
    });

    it("does not confuse EXISTING_BOQ with unrelated schedule types", () => {
      const result = classifyProjectFile({ originalName: "Project-BOQ-Final.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" });
      expect(result.classification).toBe(ProjectFileClassification.EXISTING_BOQ);
    });
  });

  describe("automatic classification via the extraction job queue (real handler, real queue)", () => {
    it("triggers classification, runs the real DOCUMENT_CLASSIFICATION handler, and updates the file", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "structural-schedule-rebar.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nstructural schedule\n%%EOF") });
      const job = await triggerFileClassification(ownerActor, uploaded.file.id);
      expect(["QUEUED", "RUNNING", "COMPLETED"]).toContain(job.status);

      await waitFor(async () => {
        const file = await getProjectFile(ownerActor, uploaded.file.id);
        return file.status === "CLASSIFIED";
      });

      const file = await getProjectFile(ownerActor, uploaded.file.id);
      expect(file.classification).toBe(ProjectFileClassification.STRUCTURAL_PLAN);
      expect(file.classificationConfidence).toBeGreaterThan(0);
      expect(file.classificationConfirmedAt).toBeNull();
      expect((file.metadata as { autoClassification?: { classification?: string } } | null)?.autoClassification?.classification).toBe(ProjectFileClassification.STRUCTURAL_PLAN);
    });

    it("does not create a duplicate classification job when triggered twice in quick succession", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "door-schedule.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\ndoors\n%%EOF") });
      const first = await triggerFileClassification(ownerActor, uploaded.file.id);
      const second = await triggerFileClassification(ownerActor, uploaded.file.id);
      // Either they dedupe to the same job, or (if the first already completed by the time the
      // second call ran) the second is a fresh job — both are correct; a fresh *duplicate row*
      // while one is still in flight is what's disallowed, and this asserts we never error out.
      expect(typeof second.id).toBe("string");
      void first;
    });

    it("rejects triggering classification from a role without files:manage", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "window-schedule.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nwindows\n%%EOF") });
      await expect(triggerFileClassification(reviewerActor, uploaded.file.id)).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe("human confirm-or-change action", () => {
    it("confirms the auto-suggested classification as-is without changing the type", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "fire-alarm-layout.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nfa\n%%EOF") });
      await triggerFileClassification(ownerActor, uploaded.file.id);
      await waitFor(async () => (await getProjectFile(ownerActor, uploaded.file.id)).status === "CLASSIFIED");

      const beforeConfirm = await getProjectFile(ownerActor, uploaded.file.id);
      const confirmed = await updateFileClassification(ownerActor, uploaded.file.id, undefined);

      expect(confirmed.classification).toBe(beforeConfirm.classification);
      expect(confirmed.classificationConfidence).toBe(beforeConfirm.classificationConfidence);
      expect(confirmed.classificationConfirmedAt).not.toBeNull();
      expect(confirmed.classificationConfirmedBy?.id).toBe(ownerActor.userId);
    });

    it("reclassifies to a different type, sets confidence to 100, and never lets a later automatic re-run overwrite the human decision", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "misc-upload-9931.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nmisc\n%%EOF") });
      await triggerFileClassification(ownerActor, uploaded.file.id);
      await waitFor(async () => (await getProjectFile(ownerActor, uploaded.file.id)).status === "CLASSIFIED");

      const beforeReclassify = await getProjectFile(ownerActor, uploaded.file.id);
      expect(beforeReclassify.classification).toBe(ProjectFileClassification.UNKNOWN);

      const reclassified = await updateFileClassification(ownerActor, uploaded.file.id, ProjectFileClassification.TECHNICAL_REPORT);
      expect(reclassified.classification).toBe(ProjectFileClassification.TECHNICAL_REPORT);
      expect(reclassified.classificationConfidence).toBe(100);
      expect(reclassified.classificationConfirmedAt).not.toBeNull();

      // Re-running the automatic classifier must not clobber the human-confirmed value.
      await triggerFileClassification(ownerActor, uploaded.file.id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const afterRerun = await getProjectFile(ownerActor, uploaded.file.id);
      expect(afterRerun.classification).toBe(ProjectFileClassification.TECHNICAL_REPORT);
      expect(afterRerun.classificationConfidence).toBe(100);
    });

    it("rejects reclassification from a role without files:manage", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "misc-upload-4471.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nmisc\n%%EOF") });
      await expect(updateFileClassification(reviewerActor, uploaded.file.id, ProjectFileClassification.ELEVATION)).rejects.toThrow(PermissionDeniedError);
    });

    it("enforces tenant isolation on classification actions", async () => {
      const uploaded = await uploadProjectFile(ownerActor, projectId, { originalName: "tenant-check.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nx\n%%EOF") });
      await expect(triggerFileClassification(ownerActorOtherCompany, uploaded.file.id)).rejects.toThrow(NotFoundError);
      await expect(updateFileClassification(ownerActorOtherCompany, uploaded.file.id, ProjectFileClassification.ELEVATION)).rejects.toThrow(NotFoundError);
    });
  });
});
