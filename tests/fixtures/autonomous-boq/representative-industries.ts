const source = (index: number, engineId: string) => ({
  fileId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  checksumSha256: String(index).repeat(64).slice(0, 64),
  drawingIdentity: `${engineId.toUpperCase()}-PLAN-001`,
  revision: "R01",
  pageIds: [`${engineId}-page-1`],
});

const candidate = (
  engineId: string,
  ruleId: string,
  formulaInputs: Record<string, number>,
) => ({
  candidateId: `${engineId}-candidate-1`,
  subjectKey: `${engineId}:representative-scope`,
  ruleId,
  description: `${engineId} representative measured scope`,
  formulaInputs,
  evidence: [{
    evidenceId: `${engineId}-evidence-1`,
    sourceFileId: "",
    pageId: `${engineId}-page-1`,
    role: "PRIMARY" as const,
    reference: `${engineId.toUpperCase()}-PLAN-001 / R01 / page 1`,
  }],
  reconciliation: {
    status: "DIRECT" as const,
    evidenceIds: [`${engineId}-evidence-1`],
  },
});

function fixture(
  index: number,
  engineId: string,
  ruleId: string,
  formulaInputs: Record<string, number>,
  expectedQuantity: number,
  expectedUnit: string,
) {
  const frozenSource = source(index, engineId);
  const measurement = candidate(engineId, ruleId, formulaInputs);
  measurement.evidence[0].sourceFileId = frozenSource.fileId;
  return { engineId, frozenSource, measurement, expectedQuantity, expectedUnit };
}

export const REPRESENTATIVE_INDUSTRY_FIXTURES = [
  fixture(1, "construction", "foundation-concrete", { length: 5, width: 4, depth: 0.3 }, 6, "m3"),
  fixture(2, "interior-fitout", "floor-finish-area", { netFloorArea: 120, wastagePercentage: 5 }, 126, "m2"),
  fixture(3, "furniture", "furniture-unit-count", { verifiedCount: 24 }, 24, "pcs"),
  fixture(4, "mep", "mep-pipe-route", { verifiedRouteLength: 80, approvedAllowancePercentage: 5 }, 84, "m"),
  fixture(5, "electrical", "electrical-cable-route", { routeLength: 75, verticalDrops: 6, approvedTerminationAllowance: 4 }, 85, "m"),
  fixture(6, "hvac", "hvac-duct-surface", { ductPerimeter: 2.4, length: 30 }, 72, "m2"),
  fixture(7, "plumbing", "plumbing-pipe-route", { verifiedRouteLength: 100, approvedAllowancePercentage: 2 }, 102, "m"),
  fixture(8, "firefighting", "firefighting-head-count", { verifiedCount: 36 }, 36, "nos"),
  fixture(9, "joinery", "joinery-unit-count", { verifiedCount: 30 }, 30, "pcs"),
  fixture(10, "landscaping", "landscape-irrigation-route", { verifiedRouteLength: 200, approvedAllowancePercentage: 0 }, 200, "m"),
] as const;

export const UNSUPPORTED_DESIGN_FIXTURES = [
  { engineId: "electrical", capability: "loadEstimate", code: "UNSUPPORTED_DESIGN_SIZING" },
  { engineId: "hvac", capability: "capacityLoad", code: "UNSUPPORTED_DESIGN_SIZING" },
  { engineId: "plumbing", capability: "flowEstimate", code: "UNSUPPORTED_DESIGN_SIZING" },
  { engineId: "firefighting", capability: "pumpSizing", code: "UNSUPPORTED_DESIGN_SIZING" },
  { engineId: "landscaping", capability: "plantSpacing", code: "UNSUPPORTED_DESIGN_SIZING" },
] as const;

export const REPRESENTATIVE_FAMILY_FIXTURES = [
  { requestedIndustry: "architectural", engineId: "interior-fitout" },
  { requestedIndustry: "civil", engineId: "construction" },
  { requestedIndustry: "structural", engineId: "construction" },
  { requestedIndustry: "infrastructure", engineId: "construction" },
] as const;
