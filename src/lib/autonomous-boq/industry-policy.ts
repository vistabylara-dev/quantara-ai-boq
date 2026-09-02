import { QuantityCalculationType } from "@prisma/client";
import { demoIndustries } from "@/config/industries";
import {
  AUTONOMOUS_POLICY_VERSION,
  stableAutonomousHash,
  type AutonomousIndustryContext,
  type AutonomousIndustryEngineId,
  type AutonomousIndustryPolicy,
  type AutonomousPolicyRule,
  type AutonomousUnsupportedCapability,
} from "./contract";

const rule = (
  id: string,
  sectionId: string,
  calculationType: QuantityCalculationType,
  boqUnit: string,
  label: string,
  declaredCapabilities: readonly string[] = [],
): AutonomousPolicyRule => ({ id, sectionId, calculationType, boqUnit, label, declaredCapabilities });

const unsupported = (
  capability: string,
  code: AutonomousUnsupportedCapability["code"],
  reason: string,
): AutonomousUnsupportedCapability => ({ capability, code, reason });

const policy = (
  engineId: AutonomousIndustryEngineId,
  rules: readonly AutonomousPolicyRule[],
  unsupportedCapabilities: readonly AutonomousUnsupportedCapability[] = [],
  assemblyMode: AutonomousIndustryPolicy["assemblyMode"] = "GENERIC_POLICY",
): AutonomousIndustryPolicy => ({ engineId, policyVersion: AUTONOMOUS_POLICY_VERSION, assemblyMode, rules, unsupportedCapabilities });

const POLICIES: Record<AutonomousIndustryEngineId, AutonomousIndustryPolicy> = {
  construction: policy("construction", [
    rule("foundation-concrete", "foundations", QuantityCalculationType.CONCRETE_VOLUME, "m3", "Foundation concrete", ["concreteVolume"]),
    rule("foundation-excavation", "foundations", QuantityCalculationType.EXCAVATION_VOLUME, "m3", "Foundation excavation", ["excavationVolume"]),
    rule("structural-reinforcement", "concrete", QuantityCalculationType.REINFORCEMENT_WEIGHT, "kg", "Reinforcement from verified schedule or bar data", ["reinforcementTotal"]),
    rule("structural-formwork", "formwork", QuantityCalculationType.FORMWORK_AREA, "m2", "Exposed concrete formwork", ["formworkArea"]),
    rule("measured-blockwork", "blockwork", QuantityCalculationType.WALL_AREA, "m2", "Measured wall area", ["wallArea"]),
  ]),
  "interior-fitout": policy("interior-fitout", [
    rule("floor-finish-area", "flooring", QuantityCalculationType.FLOOR_AREA, "m2", "Floor finish area", ["flooringArea"]),
    rule("ceiling-finish-area", "ceilings", QuantityCalculationType.CEILING_AREA, "m2", "Ceiling finish area", ["ceilingArea"]),
    rule("skirting-length", "flooring", QuantityCalculationType.SKIRTING_LENGTH, "lm", "Skirting length", ["skirtingLength"]),
    rule("wall-finish-area", "wall-finishes", QuantityCalculationType.WALL_AREA, "m2", "Wall finish area", ["wallFinishArea"]),
    rule("partition-area", "partitions", QuantityCalculationType.PARTITION_AREA, "m2", "Partition faces"),
    rule("paint-area", "wall-finishes", QuantityCalculationType.PAINT_AREA, "m2", "Painted surface area"),
    rule("fitout-item-count", "demolition", QuantityCalculationType.COUNT, "nos", "Evidence-backed item count"),
  ]),
  furniture: policy("furniture", [
    rule("furniture-unit-count", "seating", QuantityCalculationType.COUNT, "pcs", "Furniture unit count", ["unitCount"]),
    rule("furniture-set-count", "workstations", QuantityCalculationType.COUNT, "sets", "Furniture set count", ["setQuantity"]),
  ], [
    unsupported("optionSelection", "UNSUPPORTED_DESIGN_SELECTION", "Option selection is a specification or commercial decision, not a deterministic quantity formula."),
  ]),
  mep: policy("mep", [
    rule("mep-pipe-route", "plumbing", QuantityCalculationType.PIPE_LENGTH, "m", "Verified pipe route", ["pipeLength"]),
    rule("mep-cable-route", "electrical", QuantityCalculationType.CABLE_LENGTH, "m", "Verified cable route", ["cableLength"]),
    rule("mep-equipment-count", "mechanical", QuantityCalculationType.COUNT, "nos", "Equipment count", ["equipmentCount"]),
    rule("mep-duct-surface", "mechanical", QuantityCalculationType.DUCT_SURFACE_AREA, "m2", "Duct surface area"),
  ]),
  electrical: policy("electrical", [
    rule("electrical-cable-route", "cabling", QuantityCalculationType.CABLE_LENGTH, "m", "Cable route", ["cableLength"]),
    rule("electrical-circuit-count", "distribution", QuantityCalculationType.COUNT, "nos", "Circuit count", ["circuitCount"]),
    rule("electrical-point-count", "lighting", QuantityCalculationType.COUNT, "points", "Electrical point count"),
  ], [
    unsupported("loadEstimate", "UNSUPPORTED_DESIGN_SIZING", "Electrical load estimation is design work and has no registered deterministic take-off formula."),
  ]),
  hvac: policy("hvac", [
    rule("hvac-duct-surface", "ductwork", QuantityCalculationType.DUCT_SURFACE_AREA, "m2", "Duct surface area", ["ductArea"]),
    rule("hvac-pipe-route", "piping", QuantityCalculationType.PIPE_LENGTH, "m", "HVAC pipe route", ["pipeLength"]),
    rule("hvac-equipment-count", "equipment", QuantityCalculationType.COUNT, "nos", "HVAC equipment count"),
  ], [
    unsupported("capacityLoad", "UNSUPPORTED_DESIGN_SIZING", "HVAC capacity calculation is design work and has no registered deterministic take-off formula."),
  ]),
  plumbing: policy("plumbing", [
    rule("plumbing-pipe-route", "water-supply", QuantityCalculationType.PIPE_LENGTH, "m", "Water supply pipe route", ["pipeLength"]),
    rule("plumbing-fixture-count", "sanitary", QuantityCalculationType.COUNT, "nos", "Sanitary fixture count", ["fixtureCount"]),
  ], [
    unsupported("flowEstimate", "UNSUPPORTED_DESIGN_SIZING", "Hydraulic flow estimation is design work and has no registered deterministic take-off formula."),
  ]),
  firefighting: policy("firefighting", [
    rule("firefighting-pipe-route", "sprinkler", QuantityCalculationType.PIPE_LENGTH, "m", "Fire protection pipe route", ["pipeLength"]),
    rule("firefighting-head-count", "sprinkler", QuantityCalculationType.COUNT, "nos", "Sprinkler head count", ["headCount"]),
  ], [
    unsupported("pumpSizing", "UNSUPPORTED_DESIGN_SIZING", "Fire-pump sizing is hydraulic design work and has no registered deterministic take-off formula."),
  ]),
  joinery: policy("joinery", [
    rule("joinery-unit-count", "full-cutting-list-all-rooms", QuantityCalculationType.COUNT, "pcs", "Verified joinery unit multiplicity", ["unitMultiplicity"]),
  ], [
    unsupported("panelArea", "SPECIALIZED_ENGINE_REQUIRED", "Panel area remains owned by the canonical Joinery cutting-list engine."),
    unsupported("sheetQuantity", "SPECIALIZED_ENGINE_REQUIRED", "Sheet ordering remains owned by the canonical Joinery cutting-list engine."),
    unsupported("edgeBandingLength", "SPECIALIZED_ENGINE_REQUIRED", "Edge banding remains owned by the canonical Joinery cutting-list engine."),
    unsupported("hardwareQuantity", "SPECIALIZED_ENGINE_REQUIRED", "Hardware ordering remains owned by the canonical Joinery cutting-list engine."),
  ], "SPECIALIZED_JOINERY"),
  landscaping: policy("landscaping", [
    rule("landscape-irrigation-route", "irrigation", QuantityCalculationType.PIPE_LENGTH, "m", "Verified irrigation route", ["irrigationLength"]),
    rule("landscape-plant-count", "trees", QuantityCalculationType.COUNT, "nos", "Scheduled plant count"),
  ], [
    unsupported("plantSpacing", "UNSUPPORTED_DESIGN_SIZING", "Plant spacing is a design rule and has no registered deterministic take-off formula."),
    unsupported("coverageArea", "UNREGISTERED_MEASUREMENT_FORMULA", "Coverage area is measurable, but generic AREA has no registered deterministic formula."),
  ]),
};

type FamilyRoute = {
  engineId: AutonomousIndustryEngineId;
  allowedRuleIds: readonly string[];
  scopeNote: string;
};

const FAMILY_ROUTES: Record<string, FamilyRoute> = {
  architectural: {
    engineId: "interior-fitout",
    allowedRuleIds: ["floor-finish-area", "ceiling-finish-area", "skirting-length", "wall-finish-area", "partition-area", "paint-area"],
    scopeNote: "Architectural measured finishes only; envelope, facade and roofing scope require a separate supported policy.",
  },
  "architectural-finishes": {
    engineId: "interior-fitout",
    allowedRuleIds: ["floor-finish-area", "ceiling-finish-area", "skirting-length", "wall-finish-area", "partition-area", "paint-area"],
    scopeNote: "Architectural measured finishes under the Interior Fit-Out policy.",
  },
  civil: {
    engineId: "construction",
    allowedRuleIds: ["foundation-excavation", "foundation-concrete", "measured-blockwork"],
    scopeNote: "Civil excavation, concrete and measured wall scope only.",
  },
  "civil-works": {
    engineId: "construction",
    allowedRuleIds: ["foundation-excavation", "foundation-concrete", "measured-blockwork"],
    scopeNote: "Civil excavation, concrete and measured wall scope only.",
  },
  structural: {
    engineId: "construction",
    allowedRuleIds: ["foundation-concrete", "structural-reinforcement", "structural-formwork"],
    scopeNote: "Structural concrete, reinforcement and formwork under the Construction policy.",
  },
  infrastructure: {
    engineId: "construction",
    allowedRuleIds: ["foundation-excavation", "foundation-concrete"],
    scopeNote: "Measured excavation and concrete only; road build-ups and utility design are outside the registered formulas.",
  },
  "site-infrastructure": {
    engineId: "construction",
    allowedRuleIds: ["foundation-excavation", "foundation-concrete"],
    scopeNote: "Measured excavation and concrete only; road build-ups and utility design are outside the registered formulas.",
  },
};

const engineById = new Map(demoIndustries.map((engine) => [engine.id, engine]));

export function listAutonomousIndustryPolicies(): readonly AutonomousIndustryPolicy[] {
  return Object.values(POLICIES);
}

export function getAutonomousIndustryPolicy(engineId: AutonomousIndustryEngineId): AutonomousIndustryPolicy {
  return POLICIES[engineId];
}

export type AutonomousIndustryResolution =
  | { status: "SUPPORTED"; context: AutonomousIndustryContext }
  | { status: "BLOCKED"; requestedIndustry: string; code: "UNSUPPORTED_INDUSTRY_FAMILY"; reason: string };

export function resolveAutonomousIndustry(requestedIndustry: string): AutonomousIndustryResolution {
  const normalized = requestedIndustry.trim().toLowerCase();
  if (normalized === "facilities-management" || normalized === "facilities management") {
    return {
      status: "BLOCKED",
      requestedIndustry: normalized === "facilities management" ? "facilities-management" : normalized,
      code: "UNSUPPORTED_INDUSTRY_FAMILY",
      reason: "Facilities management has no enabled autonomous measurement policy.",
    };
  }

  const direct = POLICIES[normalized as AutonomousIndustryEngineId];
  const route = direct
    ? { engineId: direct.engineId, allowedRuleIds: direct.rules.map((candidate) => candidate.id), scopeNote: `Canonical ${direct.engineId} measurement policy.` }
    : FAMILY_ROUTES[normalized];
  if (!route) {
    return {
      status: "BLOCKED",
      requestedIndustry: normalized,
      code: "UNSUPPORTED_INDUSTRY_FAMILY",
      reason: `No enabled autonomous measurement policy exists for ${normalized || "the requested industry"}.`,
    };
  }

  const selectedPolicy = POLICIES[route.engineId];
  const engine = engineById.get(route.engineId);
  if (!engine) throw new Error(`Enabled industry configuration ${route.engineId} is missing.`);
  return {
    status: "SUPPORTED",
    context: {
      requestedIndustry: normalized,
      engineId: route.engineId,
      engineConfigHash: stableAutonomousHash(engine),
      policyHash: stableAutonomousHash(selectedPolicy),
      policyVersion: AUTONOMOUS_POLICY_VERSION,
      allowedRuleIds: [...route.allowedRuleIds],
      policy: selectedPolicy,
      scopeNote: route.scopeNote,
    },
  };
}
