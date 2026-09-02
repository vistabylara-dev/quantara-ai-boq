import { ExtractedEntityStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  resolveMeasurementPersistencePolicy,
} from "@/lib/services/tayqan-measurement-service";
import { TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX } from "@/lib/tayqan/tayqan-measurement-contract";

describe("shared drawing measurement persistence policy", () => {
  it("keeps the paid TAYQAN path proposal-only and commercially unchanged", () => {
    expect(resolveMeasurementPersistencePolicy()).toEqual({
      status: ExtractedEntityStatus.EXTRACTED,
      confirmedAt: null,
      confirmedByUserId: null,
      calculatedByPrefix: TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
      measurementVersion: "tayqan-measurement-v3-autonomous-router",
      measurementAuditAction: "TAYQAN_MEASUREMENT_PROPOSED",
      completionAuditAction: "TAYQAN_MEASUREMENT_PASS_COMPLETED",
      actorName: null,
      systemValidated: false,
    });
  });

  it("records an autonomous result as system validated without fabricating a human confirmer", () => {
    const policy = resolveMeasurementPersistencePolicy({
      mode: "SYSTEM_VALIDATED",
      calculatedByPrefix: `UNIVERSAL:${"a".repeat(64)}:`,
      measurementVersion: "autonomous-boq-preparation-v1",
      measurementAuditAction: "AUTONOMOUS_MEASUREMENT_SYSTEM_VALIDATED",
      completionAuditAction: "AUTONOMOUS_MEASUREMENT_PASS_COMPLETED",
      actorName: "Quantara system validation",
    });

    expect(policy.status).toBe(ExtractedEntityStatus.CONFIRMED);
    expect(policy.confirmedAt).toBeInstanceOf(Date);
    expect(policy.confirmedByUserId).toBeNull();
    expect(policy.calculatedByPrefix).toBe(`UNIVERSAL:${"a".repeat(64)}:`);
    expect(policy.systemValidated).toBe(true);
    expect(policy.actorName).toBe("Quantara system validation");
  });

  it("rejects a system-validation request without an operation-bound fingerprint prefix", () => {
    expect(() => resolveMeasurementPersistencePolicy({
      mode: "SYSTEM_VALIDATED",
      calculatedByPrefix: "UNIVERSAL:",
      measurementVersion: "autonomous-boq-preparation-v1",
      measurementAuditAction: "AUTONOMOUS_MEASUREMENT_SYSTEM_VALIDATED",
      completionAuditAction: "AUTONOMOUS_MEASUREMENT_PASS_COMPLETED",
      actorName: "Quantara system validation",
    })).toThrow(/operation-bound/i);
  });
});
