import { createHash } from "node:crypto";
import {
  calculateDerivedFurnitureHardware,
  calculateFurnitureBoardGroups,
  calculateFurnitureEdgeBanding,
  FURNITURE_ORDER_CATEGORIES,
  separateFurnitureOrderItems,
  type FurnitureOrderCategory,
  type FurnitureOrderItem,
} from "./calculations";
import type { FurniturePartCandidate } from "./candidate-mapper";
import type { FurnitureCandidateDiscipline } from "./candidate-mapper";
import { FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE } from "./linear-edge-format";

export const FURNITURE_CANONICAL_OUTPUT_VERSION = "furniture-canonical-output-v1" as const;
export const DEFAULT_FURNITURE_WASTAGE_PERCENTAGE = 10 as const;
export const FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX = "Furniture managed input signature: " as const;

export const FURNITURE_CANONICAL_SECTIONS = [
  { code: "PRJ", title: "PROJECT SUMMARY", description: "Project, discipline, source, and verified scope summary." },
  {
    code: "BRD",
    title: "BOARD / SHEET MATERIAL — ORDER QUANTITIES",
    description: "Grouped board and sheet ordering quantities with the selected wastage allowance shown on every row.",
  },
  {
    code: "HWA",
    title: "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
    description: "Confirmed hardware, accessories, proprietary systems, and explicitly separated specialist items.",
  },
  {
    code: "CUT",
    title: "FULL CUTTING LIST — ALL ROOMS",
    description: "Confirmed room, elevation, assembly, and part cutting list with source evidence.",
  },
  {
    code: "VER",
    title: "NOTES, ASSUMPTIONS & VERIFICATION ITEMS",
    description: "Visible assumptions, exclusions, unresolved readings, and professional verification notes.",
  },
] as const;

export type FurnitureCanonicalSectionCode = (typeof FURNITURE_CANONICAL_SECTIONS)[number]["code"];

export type ConfirmedFurnitureCandidate = {
  entityId: string;
  status: "CONFIRMED";
  confirmedAt: string;
  updatedAt: string;
  candidate: FurniturePartCandidate;
};

export type ConfirmedFurnitureOrderItem = {
  entityId: string;
  status: "CONFIRMED";
  confirmedAt: string;
  updatedAt: string;
  item: FurnitureOrderItem;
};

export type FurnitureCanonicalEvidence = {
  extractedEntityIds: string[];
  candidateIds: string[];
  sourceFileIds: string[];
  sourceFileNames: string[];
  sourceReferences: string[];
  sourceCellReferences: string[];
  confirmationTimestamps: string[];
  sourceMethods: string[];
};

export type FurnitureCanonicalItem = {
  managedKey: string;
  sectionCode: FurnitureCanonicalSectionCode;
  category: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  wastagePercentage: number;
  roomOrZone: string;
  drawingReference: string;
  confidenceScore: number;
  notes: string;
  evidence: FurnitureCanonicalEvidence;
};

export type FurnitureCanonicalSection = (typeof FURNITURE_CANONICAL_SECTIONS)[number] & {
  sortOrder: number;
  items: FurnitureCanonicalItem[];
};

export type FurnitureCanonicalOutput = {
  outputVersion: typeof FURNITURE_CANONICAL_OUTPUT_VERSION;
  projectId: string;
  projectReference: string;
  projectName: string;
  discipline: FurnitureCandidateDiscipline;
  wastagePercentage: number;
  confirmedCandidateCount: number;
  inputSignature: string;
  orderItemsByCategory: Record<FurnitureOrderCategory, FurnitureOrderItem[]>;
  sections: FurnitureCanonicalSection[];
};

export type BuildFurnitureCanonicalOutputInput = {
  projectId: string;
  projectReference: string;
  projectName: string;
  discipline: FurnitureCandidateDiscipline;
  /**
   * Caller-owned and required. UIs should initialize it with
   * DEFAULT_FURNITURE_WASTAGE_PERCENTAGE and may edit it before generation.
   */
  wastagePercentage: number;
  confirmedCandidates: readonly ConfirmedFurnitureCandidate[];
  confirmedOrderItems?: readonly ConfirmedFurnitureOrderItem[];
};

const EMPTY_EVIDENCE: FurnitureCanonicalEvidence = {
  extractedEntityIds: [],
  candidateIds: [],
  sourceFileIds: [],
  sourceFileNames: [],
  sourceReferences: [],
  sourceCellReferences: [],
  confirmationTimestamps: [],
  sourceMethods: [],
};

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function evidenceFor(
  confirmed: readonly ConfirmedFurnitureCandidate[],
  candidateIds?: readonly string[],
): FurnitureCanonicalEvidence {
  const allowed = candidateIds ? new Set(candidateIds) : null;
  const selected = allowed
    ? confirmed.filter((entry) => allowed.has(entry.candidate.candidateId))
    : [...confirmed];
  return {
    extractedEntityIds: unique(selected.map((entry) => entry.entityId)),
    candidateIds: unique(selected.map((entry) => entry.candidate.candidateId)),
    sourceFileIds: unique(selected.map((entry) => entry.candidate.evidence.sourceFileId)),
    sourceFileNames: unique(selected.map((entry) => entry.candidate.evidence.sourceFileName)),
    sourceReferences: unique(selected.map((entry) => {
      const evidence = entry.candidate.evidence;
      const location = evidence.sheetName ?? (evidence.pageNumber === null ? null : `page ${evidence.pageNumber}`);
      return [evidence.sourceFileName, location, `row ${evidence.rowNumber}`].filter(Boolean).join(" · ");
    })),
    sourceCellReferences: unique(selected.flatMap((entry) => entry.candidate.evidence.sourceCellReferences)),
    confirmationTimestamps: unique(selected.map((entry) => entry.confirmedAt)),
    sourceMethods: unique(selected.map((entry) => entry.candidate.evidence.method)),
  };
}

function orderItemEvidence(entry: ConfirmedFurnitureOrderItem): FurnitureCanonicalEvidence {
  const item = entry.item;
  if (!item.evidence) {
    return {
      ...EMPTY_EVIDENCE,
      extractedEntityIds: [entry.entityId],
      candidateIds: [item.id],
      confirmationTimestamps: [entry.confirmedAt],
    };
  }
  return {
    ...EMPTY_EVIDENCE,
    extractedEntityIds: [entry.entityId],
    candidateIds: [item.id],
    sourceFileIds: unique([item.evidence.sourceFileId]),
    sourceFileNames: unique([item.evidence.sourceFileName]),
    sourceReferences: [
      [item.evidence.sheetName, `row ${item.evidence.rowNumber}`].filter(Boolean).join(" · "),
    ],
    sourceCellReferences: unique(item.evidence.sourceCellReferences),
    confirmationTimestamps: [entry.confirmedAt],
    sourceMethods: unique([item.evidence.method]),
  };
}

function combineEvidence(...evidenceGroups: readonly FurnitureCanonicalEvidence[]): FurnitureCanonicalEvidence {
  return {
    extractedEntityIds: unique(evidenceGroups.flatMap((entry) => entry.extractedEntityIds)),
    candidateIds: unique(evidenceGroups.flatMap((entry) => entry.candidateIds)),
    sourceFileIds: unique(evidenceGroups.flatMap((entry) => entry.sourceFileIds)),
    sourceFileNames: unique(evidenceGroups.flatMap((entry) => entry.sourceFileNames)),
    sourceReferences: unique(evidenceGroups.flatMap((entry) => entry.sourceReferences)),
    sourceCellReferences: unique(evidenceGroups.flatMap((entry) => entry.sourceCellReferences)),
    confirmationTimestamps: unique(evidenceGroups.flatMap((entry) => entry.confirmationTimestamps)),
    sourceMethods: unique(evidenceGroups.flatMap((entry) => entry.sourceMethods)),
  };
}

export type FurnitureInputSignatureEntity = {
  entityId: string;
  status: "CONFIRMED";
  confirmedAt: string;
  updatedAt: string;
};

export function computeFurnitureInputSignature(input: {
  discipline: FurnitureCandidateDiscipline;
  wastagePercentage: number;
  partEntities: readonly FurnitureInputSignatureEntity[];
  orderEntities: readonly FurnitureInputSignatureEntity[];
}): string {
  const normalize = (entries: readonly FurnitureInputSignatureEntity[]) => entries
    .map(({ entityId, status, confirmedAt, updatedAt }) => ({ entityId, status, confirmedAt, updatedAt }))
    .sort((left, right) => left.entityId.localeCompare(right.entityId));
  return createHash("sha256").update(JSON.stringify({
    version: FURNITURE_CANONICAL_OUTPUT_VERSION,
    discipline: input.discipline,
    wastagePercentage: input.wastagePercentage,
    partEntities: normalize(input.partEntities),
    orderEntities: normalize(input.orderEntities),
  })).digest("hex");
}

function assertConfirmedCandidates(entries: readonly ConfirmedFurnitureCandidate[]): void {
  const entityIds = new Set<string>();
  const candidateIds = new Set<string>();
  for (const entry of entries) {
    if (entry.status !== "CONFIRMED") {
      throw new Error("Furniture canonical output accepts only CONFIRMED furniture candidates.");
    }
    if (!entry.entityId || !entry.confirmedAt || !entry.updatedAt) {
      throw new Error("Every confirmed furniture candidate requires confirmation evidence.");
    }
    if (entry.candidate.quantity === null || !Number.isFinite(entry.candidate.quantity) || entry.candidate.quantity <= 0) {
      throw new Error("Every confirmed furniture candidate requires a positive numeric quantity.");
    }
    if (entityIds.has(entry.entityId) || candidateIds.has(entry.candidate.candidateId)) {
      throw new Error("Duplicate confirmed furniture candidates are not allowed.");
    }
    entityIds.add(entry.entityId);
    candidateIds.add(entry.candidate.candidateId);
  }
}

function assertConfirmedOrderItems(entries: readonly ConfirmedFurnitureOrderItem[]): ConfirmedFurnitureOrderItem[] {
  const entityIds = new Set<string>();
  const itemIds = new Set<string>();
  return entries.map((entry) => {
    if (entry.status !== "CONFIRMED") {
      throw new Error("Furniture canonical output accepts only CONFIRMED order items.");
    }
    if (!entry.entityId || !entry.confirmedAt || !entry.updatedAt) {
      throw new Error("Every confirmed furniture order item requires confirmation evidence.");
    }
    if (entityIds.has(entry.entityId) || itemIds.has(entry.item.id)) {
      throw new Error("Duplicate confirmed furniture order items are not allowed.");
    }
    if (entry.item.quantity === null || !Number.isFinite(entry.item.quantity) || entry.item.quantity <= 0) {
      throw new Error("Every confirmed furniture order item requires a positive numeric quantity.");
    }
    if (!entry.item.unit?.trim()) {
      throw new Error("Every confirmed furniture order item requires an explicit unit.");
    }
    entityIds.add(entry.entityId);
    itemIds.add(entry.item.id);
    return entry;
  });
}

function dimensionText(candidate: FurniturePartCandidate): string {
  const dimension = (key: "width" | "height" | "depth" | "thickness") =>
    candidate.dimensions[key].valueMm === null ? "unavailable" : `${candidate.dimensions[key].valueMm} mm`;
  return [
    `W ${dimension("width")}`,
    `H ${dimension("height")}`,
    `D ${dimension("depth")}`,
    `T ${dimension("thickness")}`,
  ].join(" × ");
}

function edgeText(candidate: FurniturePartCandidate): string {
  const edge = candidate.edgeBanding;
  if (edge.mode === "NONE") return "None";
  if (edge.selectedEdges.length === 0) return `${edge.raw || "Unresolved"} (orientation unresolved)`;
  return `${edge.raw}: ${edge.selectedEdges.map((selection) =>
    `${selection.count} × ${selection.dimension.toLowerCase()}`).join(", ")} (${edge.orientation.toLowerCase()})`;
}

function derivedHardwareItems(candidates: readonly FurniturePartCandidate[]): FurnitureOrderItem[] {
  const derived = calculateDerivedFurnitureHardware(candidates);
  const items: FurnitureOrderItem[] = [
    {
      id: "derived:concealed-hinges",
      description: "Concealed hinges",
      quantity: derived.hinges,
      quantityText: String(derived.hinges),
      unit: "pcs",
      category: "HARDWARE",
      suppliedByOthers: false,
      notes: "Deterministically derived from confirmed door-panel heights.",
    },
    {
      id: "derived:drawer-systems",
      description: "Proprietary drawer systems",
      quantity: derived.drawerSystems,
      quantityText: String(derived.drawerSystems),
      unit: "sets",
      category: "PROPRIETARY_DRAWER_SYSTEM",
      suppliedByOthers: false,
      notes: "Deterministically derived from confirmed drawer-front quantities.",
    },
    {
      id: "derived:shelf-pins",
      description: "Shelf pins",
      quantity: derived.shelfPins,
      quantityText: String(derived.shelfPins),
      unit: "pcs",
      category: "HARDWARE",
      suppliedByOthers: false,
      notes: "Four shelf pins per confirmed adjustable shelf.",
    },
    {
      id: "derived:pull-out-chassis",
      description: "Pull-out chassis",
      quantity: derived.pullOutChassis,
      quantityText: String(derived.pullOutChassis),
      unit: "sets",
      category: "HARDWARE",
      suppliedByOthers: false,
      notes: "Derived only from explicit pull-out assembly descriptions.",
    },
  ];
  return items.filter((item) => (item.quantity ?? 0) > 0);
}

type DerivedHardwareFamily = "HINGE" | "DRAWER_SYSTEM" | "SHELF_PIN" | "PULL_OUT_CHASSIS";

function derivedHardwareFamily(item: FurnitureOrderItem): DerivedHardwareFamily {
  if (item.id === "derived:concealed-hinges") return "HINGE";
  if (item.id === "derived:drawer-systems") return "DRAWER_SYSTEM";
  if (item.id === "derived:shelf-pins") return "SHELF_PIN";
  return "PULL_OUT_CHASSIS";
}

function isExplicitMatchForDerived(item: FurnitureOrderItem, family: DerivedHardwareFamily): boolean {
  const description = item.description.toLowerCase();
  if (family === "HINGE") return /\bhinge(?:s)?\b/.test(description);
  if (family === "DRAWER_SYSTEM") {
    return item.category === "PROPRIETARY_DRAWER_SYSTEM"
      || /\b(?:drawer\s+(?:system|box)|tandembox|legrabox)\b/.test(description);
  }
  if (family === "SHELF_PIN") return /\bshelf\s+(?:pin|support)(?:s)?\b/.test(description);
  return /\bpull[- ]out\b.*\b(?:chassis|system|drawer)(?:s)?\b/.test(description);
}

function canonicalHardwareItems(
  orderEntries: readonly ConfirmedFurnitureOrderItem[],
  confirmedCandidates: readonly ConfirmedFurnitureCandidate[],
): { items: FurnitureCanonicalItem[]; verificationItems: FurnitureCanonicalItem[] } {
  const items: FurnitureCanonicalItem[] = [];
  const verificationItems: FurnitureCanonicalItem[] = [];
  for (const entry of orderEntries) {
    const orderItem = entry.item;
    const effectiveCategory = orderItem.suppliedByOthers ? "SUPPLIED_BY_OTHERS" : orderItem.category;
    if (orderItem.quantity === null || orderItem.quantity <= 0 || !orderItem.unit?.trim()) {
      throw new Error("Confirmed furniture order items require positive quantities and explicit units.");
    }
    items.push({
      managedKey: `order:${effectiveCategory}:${orderItem.id}`,
      sectionCode: "HWA",
      category: effectiveCategory,
      description: orderItem.description,
      specification: orderItem.suppliedByOthers
        ? "Explicitly identified as supplied by others."
        : `Confirmed ${effectiveCategory.toLowerCase().replace(/_/g, " ")} order item.`,
      quantity: orderItem.quantity,
      unit: orderItem.unit,
      wastagePercentage: 0,
      roomOrZone: "",
      drawingReference: "",
      confidenceScore: Math.max(0, Math.min(100, orderItem.evidence?.confidence ?? 100)),
      notes: orderItem.notes ?? "",
      evidence: orderItemEvidence(entry),
    });
  }

  const allCandidateEvidence = evidenceFor(confirmedCandidates);
  const derivedItems = derivedHardwareItems(confirmedCandidates.map((entry) => entry.candidate));
  for (const derived of derivedItems) {
    const family = derivedHardwareFamily(derived);
    const explicitMatches = orderEntries.filter((entry) => isExplicitMatchForDerived(entry.item, family));
    if (explicitMatches.length === 0) {
      if (derived.quantity === null || derived.quantity <= 0 || !derived.unit) continue;
      items.push({
        managedKey: `order:${derived.category}:${derived.id}`,
        sectionCode: "HWA",
        category: derived.category,
        description: derived.description,
        specification: "Derived from confirmed cutting-list part types and explicit assembly descriptions.",
        quantity: derived.quantity,
        unit: derived.unit,
        wastagePercentage: 0,
        roomOrZone: "",
        drawingReference: "",
        confidenceScore: 100,
        notes: derived.notes ?? "",
        evidence: allCandidateEvidence,
      });
      continue;
    }

    const explicitQuantity = explicitMatches.reduce((sum, entry) => sum + (entry.item.quantity ?? 0), 0);
    if (derived.quantity !== null && explicitQuantity !== derived.quantity) {
      verificationItems.push({
        managedKey: `verification:hardware-reconciliation:${family.toLowerCase()}`,
        sectionCode: "VER",
        category: "VERIFICATION_ITEM",
        description: `Reconcile explicit and derived ${derived.description.toLowerCase()}`,
        specification: `Explicit schedule quantity ${explicitQuantity}; deterministic cutting-list quantity ${derived.quantity}.`,
        quantity: 1,
        unit: "verification",
        wastagePercentage: 0,
        roomOrZone: "All rooms",
        drawingReference: "",
        confidenceScore: Math.min(
          100,
          ...explicitMatches.map((entry) => entry.item.evidence?.confidence ?? 100),
        ),
        notes: "The explicit schedule remains authoritative; the discrepancy is visible and was not silently merged.",
        evidence: combineEvidence(
          allCandidateEvidence,
          ...explicitMatches.map((entry) => orderItemEvidence(entry)),
        ),
      });
    }
  }
  return { items, verificationItems };
}

export function buildFurnitureCanonicalOutput(input: BuildFurnitureCanonicalOutputInput): FurnitureCanonicalOutput {
  assertConfirmedCandidates(input.confirmedCandidates);
  if (!Number.isFinite(input.wastagePercentage) || input.wastagePercentage < 0) {
    throw new RangeError("wastagePercentage must be a finite non-negative number");
  }
  const confirmedOrderEntries = assertConfirmedOrderItems(input.confirmedOrderItems ?? []).map((entry) =>
    entry.item.suppliedByOthers && entry.item.category !== "SUPPLIED_BY_OTHERS"
      ? { ...entry, item: { ...entry.item, category: "SUPPLIED_BY_OTHERS" as const } }
      : entry);
  if (input.confirmedCandidates.length === 0 && confirmedOrderEntries.length === 0) {
    throw new Error("Furniture canonical output requires at least one confirmed part or scheduled order item.");
  }
  const confirmedOrderItems = confirmedOrderEntries.map((entry) => entry.item);
  const candidates = input.confirmedCandidates.map((entry) => entry.candidate);
  const inputSignature = computeFurnitureInputSignature({
    discipline: input.discipline,
    wastagePercentage: input.wastagePercentage,
    partEntities: input.confirmedCandidates,
    orderEntities: confirmedOrderEntries,
  });
  const allEvidence = combineEvidence(
    evidenceFor(input.confirmedCandidates),
    ...confirmedOrderEntries.map((entry) => orderItemEvidence(entry)),
  );
  const board = calculateFurnitureBoardGroups(candidates, { wastagePercentage: input.wastagePercentage });
  const edge = calculateFurnitureEdgeBanding(candidates);
  const frontEdgeUsesAssumedOrientation = candidates.some((candidate) =>
    candidate.edgeBanding.mode === "FRONT" && candidate.edgeBanding.orientation === "ASSUMED");
  const separated = separateFurnitureOrderItems(confirmedOrderItems);
  const { items: hardwareItems, verificationItems: orderVerificationItems } = canonicalHardwareItems(
    confirmedOrderEntries,
    input.confirmedCandidates,
  );
  const edgeBandingItems: FurnitureCanonicalItem[] = [
    { mode: "FRONT", label: "Front-edge banding length", quantity: edge.byMode.FRONT },
    { mode: "ALL_FOUR", label: "All-four-edge banding length", quantity: edge.byMode.ALL_FOUR },
  ].filter((entry) => entry.quantity > 0).map((entry) => ({
    managedKey: `order:HARDWARE:edge-banding:${entry.mode.toLowerCase()}`,
    sectionCode: "HWA",
    category: "HARDWARE",
    description: entry.label,
    specification: entry.mode === "FRONT"
      ? frontEdgeUsesAssumedOrientation
        ? FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE
        : "Calculated only from the explicitly selected front-edge dimension on each confirmed part."
      : "Calculated only from the explicitly selected four edges on each confirmed part.",
    quantity: entry.quantity,
    unit: "lm",
    wastagePercentage: 0,
    roomOrZone: "All rooms",
    drawingReference: "",
    confidenceScore: 100,
    notes: entry.mode === "FRONT"
      ? frontEdgeUsesAssumedOrientation
        ? FURNITURE_JOINERY_LINEAR_EDGE_ASSUMPTION_NOTE
        : "The selected front edge was professionally verified before generation."
      : "No unselected edge was included.",
    evidence: allEvidence,
  }));

  const projectItems: FurnitureCanonicalItem[] = [{
    managedKey: "project:summary",
    sectionCode: "PRJ",
    category: "PROJECT_SUMMARY",
    description: `${input.projectReference} — ${input.projectName}`,
    specification: `${input.discipline}; ${input.confirmedCandidates.length} confirmed parts; ${confirmedOrderEntries.length} confirmed scheduled items`,
    quantity: input.confirmedCandidates.length + confirmedOrderEntries.length,
    unit: "confirmed source rows",
    wastagePercentage: 0,
    roomOrZone: unique(candidates.map((candidate) => candidate.room)).join(", "),
    drawingReference: "",
    confidenceScore: 100,
    notes: `Canonical output ${FURNITURE_CANONICAL_OUTPUT_VERSION}.`,
    evidence: allEvidence,
  }];

  const boardItems: FurnitureCanonicalItem[] = board.groups.map((group) => ({
    managedKey: `board:${group.key}`,
    sectionCode: "BRD",
    category: "BOARD",
    description: `${group.thicknessMm} mm ${group.material}${group.finish ? ` (${group.finish})` : ""}`,
    specification: [
      `Net area ${group.netAreaM2.toFixed(6)} m²`,
      `${group.wastagePercentage}% wastage`,
      `order area ${group.areaWithWastageM2.toFixed(6)} m²`,
      `${group.sheetWidthMm} × ${group.sheetHeightMm} mm sheets`,
    ].join("; "),
    quantity: group.sheetsRequired,
    unit: "sheets",
    wastagePercentage: group.wastagePercentage,
    roomOrZone: "All rooms",
    drawingReference: "",
    confidenceScore: 100,
    notes: `${group.partQuantity} confirmed panel pieces; finish ${group.finish ?? "not stated"}.`,
    evidence: evidenceFor(input.confirmedCandidates, group.candidateIds),
  }));

  const cuttingItems: FurnitureCanonicalItem[] = input.confirmedCandidates.map(({ candidate }) => ({
    managedKey: `cutting:${candidate.candidateId}`,
    sectionCode: "CUT",
    category: "CUTTING_LIST",
    description: [candidate.room, candidate.elevationReference, candidate.assembly, candidate.part].join(" / "),
    specification: [
      dimensionText(candidate),
      `material ${candidate.material.name || "unavailable"}`,
      `finish ${candidate.material.finish ?? "unavailable"}`,
      `edge ${edgeText(candidate)}`,
      `grain ${candidate.grainDirection ?? "unavailable"}`,
    ].join("; "),
    quantity: candidate.quantity ?? 0,
    unit: "pcs",
    wastagePercentage: 0,
    roomOrZone: candidate.room,
    drawingReference: candidate.elevationReference,
    confidenceScore: Math.max(0, Math.min(100, candidate.evidence.confidence ?? 100)),
    notes: [candidate.notes, ...candidate.hardwareNotes].filter(Boolean).join("; "),
    evidence: evidenceFor(input.confirmedCandidates, [candidate.candidateId]),
  }));

  const verificationItems: FurnitureCanonicalItem[] = [
    {
      managedKey: "assumption:wastage",
      sectionCode: "VER",
      category: "ASSUMPTION",
      description: "Board/sheet material wastage allowance",
      specification: `${input.wastagePercentage}% was selected by the caller for this generation.`,
      quantity: 1,
      unit: "record",
      wastagePercentage: input.wastagePercentage,
      roomOrZone: "All rooms",
      drawingReference: "",
      confidenceScore: 100,
      notes: `Default is ${DEFAULT_FURNITURE_WASTAGE_PERCENTAGE}% and remains editable before every regeneration.`,
      evidence: EMPTY_EVIDENCE,
    },
    {
      managedKey: "integrity:input-signature",
      sectionCode: "VER",
      category: "VERIFICATION_ITEM",
      description: "Managed furniture input integrity",
      specification: `${FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX}${inputSignature}`,
      quantity: 1,
      unit: "verification",
      wastagePercentage: input.wastagePercentage,
      roomOrZone: "All rooms",
      drawingReference: "",
      confidenceScore: 100,
      notes: "Generation fingerprint for the exact confirmed part and order-item source set.",
      evidence: combineEvidence(
        allEvidence,
        ...confirmedOrderEntries.map((entry) => orderItemEvidence(entry)),
      ),
    },
    ...board.excluded.map((excluded) => ({
      managedKey: `verification:board:${excluded.candidateId}`,
      sectionCode: "VER" as const,
      category: "VERIFICATION_ITEM",
      description: "Candidate excluded from board order calculation",
      specification: excluded.reason,
      quantity: 1,
      unit: "verification",
      wastagePercentage: 0,
      roomOrZone: "",
      drawingReference: "",
      confidenceScore: 100,
      notes: "No board quantity was guessed.",
      evidence: evidenceFor(input.confirmedCandidates, [excluded.candidateId]),
    })),
    ...input.confirmedCandidates.flatMap(({ candidate }) => candidate.issues.map((candidateIssue, issueIndex) => ({
      managedKey: `verification:candidate:${candidate.candidateId}:${candidateIssue.code}:${issueIndex}`,
      sectionCode: "VER" as const,
      category: "VERIFICATION_ITEM",
      description: `${candidate.room} / ${candidate.assembly} / ${candidate.part}: ${candidateIssue.code}`,
      specification: candidateIssue.message,
      quantity: 1,
      unit: "verification",
      wastagePercentage: 0,
      roomOrZone: candidate.room,
      drawingReference: candidate.elevationReference,
      confidenceScore: Math.max(0, Math.min(100, candidate.evidence.confidence ?? 100)),
      notes: candidateIssue.evidenceReferences.join(", "),
      evidence: evidenceFor(input.confirmedCandidates, [candidate.candidateId]),
    }))),
    ...orderVerificationItems,
  ];

  if (edge.unresolvedCandidateIds.length > 0) {
    verificationItems.push({
      managedKey: "verification:edge-banding-unresolved",
      sectionCode: "VER",
      category: "VERIFICATION_ITEM",
      description: "Edge-banding length has unresolved orientations",
      specification: `${edge.unresolvedCandidateIds.length} confirmed candidates need an explicit edge orientation before a total can be ordered.`,
      quantity: edge.unresolvedCandidateIds.length,
      unit: "candidates",
      wastagePercentage: 0,
      roomOrZone: "All rooms",
      drawingReference: "",
      confidenceScore: 100,
      notes: "No alternate panel dimension was substituted.",
      evidence: evidenceFor(input.confirmedCandidates, edge.unresolvedCandidateIds),
    });
  }

  const itemsBySection: Record<FurnitureCanonicalSectionCode, FurnitureCanonicalItem[]> = {
    PRJ: projectItems,
    BRD: boardItems,
    HWA: [...hardwareItems, ...edgeBandingItems],
    CUT: cuttingItems,
    VER: verificationItems,
  };
  return {
    outputVersion: FURNITURE_CANONICAL_OUTPUT_VERSION,
    projectId: input.projectId,
    projectReference: input.projectReference,
    projectName: input.projectName,
    discipline: input.discipline,
    wastagePercentage: input.wastagePercentage,
    confirmedCandidateCount: input.confirmedCandidates.length,
    inputSignature,
    orderItemsByCategory: Object.fromEntries(
      FURNITURE_ORDER_CATEGORIES.map((category) => [category, separated[category]]),
    ) as Record<FurnitureOrderCategory, FurnitureOrderItem[]>,
    sections: FURNITURE_CANONICAL_SECTIONS.map((section, index) => ({
      ...section,
      sortOrder: index + 1,
      items: itemsBySection[section.code],
    })),
  };
}
