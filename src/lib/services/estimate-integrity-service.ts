import {
  MarginMode,
  Prisma,
  QuantityProvenanceSource,
  RateProvenanceSource,
} from "@prisma/client";

export type IntegrityActor = {
  userId?: string | null;
  name: string;
};

export type IntegrityItemValues = {
  id: string;
  quantity: Prisma.Decimal.Value;
  unit: string;
  unitCost: Prisma.Decimal.Value;
  freightCost: Prisma.Decimal.Value;
  installationCost: Prisma.Decimal.Value;
  additionalCost: Prisma.Decimal.Value;
  marginMode: MarginMode;
  marginPercentage: Prisma.Decimal.Value;
};

const DEFAULT_ACTOR: IntegrityActor = { name: "Authorized BOQ editor" };

function confirmation(actor?: IntegrityActor) {
  const confirmedAt = new Date();
  const confirmedByUserId = actor?.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actor.userId)
    ? actor.userId
    : null;
  return {
    confirmedByUserId,
    confirmedByName: actor?.name?.trim() || DEFAULT_ACTOR.name,
    confirmedAt,
  };
}

function quantitySnapshot(item: IntegrityItemValues) {
  return {
    quantitySnapshot: new Prisma.Decimal(item.quantity),
    unitSnapshot: item.unit,
  };
}

function rateSnapshot(item: IntegrityItemValues) {
  return {
    unitCostSnapshot: new Prisma.Decimal(item.unitCost),
    freightCostSnapshot: new Prisma.Decimal(item.freightCost),
    installationCostSnapshot: new Prisma.Decimal(item.installationCost),
    additionalCostSnapshot: new Prisma.Decimal(item.additionalCost),
    marginModeSnapshot: item.marginMode,
    marginPercentageSnapshot: new Prisma.Decimal(item.marginPercentage),
  };
}

/** Every newly created editable item starts with explicit manual provenance. */
export async function initializeManualItemProvenance(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  item: IntegrityItemValues,
  actor?: IntegrityActor,
  initialRateSource: RateProvenanceSource = RateProvenanceSource.MANUAL_CONFIRMED,
) {
  const confirmed = confirmation(actor);
  await tx.bOQItemQuantityProvenance.create({
    data: {
      companyId,
      projectId,
      boqItemId: item.id,
      sourceType: QuantityProvenanceSource.MANUAL_CONFIRMED,
      ...quantitySnapshot(item),
      ...confirmed,
    },
  });
  await tx.bOQItemRateProvenance.create({
    data: {
      companyId,
      projectId,
      boqItemId: item.id,
      sourceType: initialRateSource,
      ...rateSnapshot(item),
      ...confirmed,
    },
  });
}

export async function confirmManualQuantityProvenance(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  item: IntegrityItemValues,
  actor?: IntegrityActor,
) {
  const confirmed = confirmation(actor);
  await tx.bOQItemQuantityProvenance.upsert({
    where: { boqItemId: item.id },
    create: {
      companyId,
      projectId,
      boqItemId: item.id,
      sourceType: QuantityProvenanceSource.MANUAL_CONFIRMED,
      ...quantitySnapshot(item),
      ...confirmed,
    },
    update: {
      sourceType: QuantityProvenanceSource.MANUAL_CONFIRMED,
      extractedEntityId: null,
      quantityCalculationId: null,
      projectFileId: null,
      sourceBoqItemQuantityProvenanceId: null,
      ...quantitySnapshot(item),
      ...confirmed,
    },
  });
}

export async function confirmManualRateProvenance(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  item: IntegrityItemValues,
  actor?: IntegrityActor,
) {
  const confirmed = confirmation(actor);
  await tx.bOQItemRateProvenance.upsert({
    where: { boqItemId: item.id },
    create: {
      companyId,
      projectId,
      boqItemId: item.id,
      sourceType: RateProvenanceSource.MANUAL_CONFIRMED,
      ...rateSnapshot(item),
      ...confirmed,
    },
    update: {
      sourceType: RateProvenanceSource.MANUAL_CONFIRMED,
      rateCatalogueItemId: null,
      sourceBoqItemRateProvenanceId: null,
      sourceEffectiveDate: null,
      sourceExpiryDate: null,
      ...rateSnapshot(item),
      ...confirmed,
    },
  });
}

export async function recordReviewedExtractionQuantity(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    projectId: string;
    item: IntegrityItemValues;
    extractedEntityId: string;
    projectFileId: string;
    quantityCalculationId?: string;
    actor: IntegrityActor;
  },
) {
  const confirmed = confirmation(input.actor);
  await tx.bOQItemQuantityProvenance.upsert({
    where: { boqItemId: input.item.id },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      boqItemId: input.item.id,
      sourceType: QuantityProvenanceSource.REVIEWED_EXTRACTION,
      extractedEntityId: input.extractedEntityId,
      quantityCalculationId: input.quantityCalculationId ?? null,
      projectFileId: input.projectFileId,
      ...quantitySnapshot(input.item),
      ...confirmed,
    },
    update: {
      sourceType: QuantityProvenanceSource.REVIEWED_EXTRACTION,
      extractedEntityId: input.extractedEntityId,
      quantityCalculationId: input.quantityCalculationId ?? null,
      projectFileId: input.projectFileId,
      sourceBoqItemQuantityProvenanceId: null,
      ...quantitySnapshot(input.item),
      ...confirmed,
    },
  });
}

export async function recordConfirmedCalculationQuantity(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    projectId: string;
    item: IntegrityItemValues;
    quantityCalculationId: string;
    actor: IntegrityActor;
  },
) {
  const confirmed = confirmation(input.actor);
  await tx.bOQItemQuantityProvenance.upsert({
    where: { boqItemId: input.item.id },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      boqItemId: input.item.id,
      sourceType: QuantityProvenanceSource.CONFIRMED_CALCULATION,
      quantityCalculationId: input.quantityCalculationId,
      ...quantitySnapshot(input.item),
      ...confirmed,
    },
    update: {
      sourceType: QuantityProvenanceSource.CONFIRMED_CALCULATION,
      extractedEntityId: null,
      quantityCalculationId: input.quantityCalculationId,
      projectFileId: null,
      sourceBoqItemQuantityProvenanceId: null,
      ...quantitySnapshot(input.item),
      ...confirmed,
    },
  });
}

export async function recordRateProvenance(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    projectId: string;
    item: IntegrityItemValues;
    sourceType: RateProvenanceSource;
    rateCatalogueItemId?: string | null;
    sourceBoqItemRateProvenanceId?: string | null;
    currency?: string;
    effectiveDate?: Date | null;
    expiryDate?: Date | null;
    actor: IntegrityActor;
  },
) {
  const confirmed = confirmation(input.actor);
  await tx.bOQItemRateProvenance.upsert({
    where: { boqItemId: input.item.id },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      boqItemId: input.item.id,
      sourceType: input.sourceType,
      rateCatalogueItemId: input.rateCatalogueItemId ?? null,
      sourceBoqItemRateProvenanceId: input.sourceBoqItemRateProvenanceId ?? null,
      currencySnapshot: input.currency ?? "AED",
      sourceEffectiveDate: input.effectiveDate ?? null,
      sourceExpiryDate: input.expiryDate ?? null,
      ...rateSnapshot(input.item),
      ...confirmed,
    },
    update: {
      sourceType: input.sourceType,
      rateCatalogueItemId: input.rateCatalogueItemId ?? null,
      sourceBoqItemRateProvenanceId: input.sourceBoqItemRateProvenanceId ?? null,
      currencySnapshot: input.currency ?? "AED",
      sourceEffectiveDate: input.effectiveDate ?? null,
      sourceExpiryDate: input.expiryDate ?? null,
      ...rateSnapshot(input.item),
      ...confirmed,
    },
  });
}

/** Copy current evidence through an explicit chain; never claim the old source as newly reviewed. */
export async function copyItemProvenance(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    projectId: string;
    sourceItemId: string;
    item: IntegrityItemValues;
    rateSourceType?: RateProvenanceSource;
    actor?: IntegrityActor;
  },
) {
  const [sourceQuantity, sourceRate] = await Promise.all([
    tx.bOQItemQuantityProvenance.findUnique({ where: { boqItemId: input.sourceItemId } }),
    tx.bOQItemRateProvenance.findUnique({ where: { boqItemId: input.sourceItemId } }),
  ]);
  if (!sourceQuantity || !sourceRate) {
    throw new Error("Source BOQ item does not have a complete provenance graph.");
  }
  const confirmed = confirmation(input.actor);
  const quantityIsConfirmed = sourceQuantity.sourceType !== QuantityProvenanceSource.LEGACY_UNVERIFIED && sourceQuantity.confirmedAt !== null;
  const rateIsConfirmed = sourceRate.sourceType !== RateProvenanceSource.LEGACY_UNVERIFIED && sourceRate.confirmedAt !== null;
  await tx.bOQItemQuantityProvenance.upsert({
    where: { boqItemId: input.item.id },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      boqItemId: input.item.id,
      sourceType: quantityIsConfirmed ? QuantityProvenanceSource.COPIED : QuantityProvenanceSource.LEGACY_UNVERIFIED,
      sourceBoqItemQuantityProvenanceId: sourceQuantity.id,
      ...quantitySnapshot(input.item),
      ...(quantityIsConfirmed
        ? confirmed
        : { confirmedByUserId: null, confirmedByName: "Copied from unverified quantity evidence", confirmedAt: null }),
    },
    update: {
      sourceType: quantityIsConfirmed ? QuantityProvenanceSource.COPIED : QuantityProvenanceSource.LEGACY_UNVERIFIED,
      extractedEntityId: null,
      quantityCalculationId: null,
      projectFileId: null,
      sourceBoqItemQuantityProvenanceId: sourceQuantity.id,
      ...quantitySnapshot(input.item),
      ...(quantityIsConfirmed
        ? confirmed
        : { confirmedByUserId: null, confirmedByName: "Copied from unverified quantity evidence", confirmedAt: null }),
    },
  });
  if (rateIsConfirmed) {
    await recordRateProvenance(tx, {
      companyId: input.companyId,
      projectId: input.projectId,
      item: input.item,
      sourceType: input.rateSourceType ?? RateProvenanceSource.COPIED,
      sourceBoqItemRateProvenanceId: sourceRate.id,
      currency: sourceRate.currencySnapshot,
      actor: input.actor ?? DEFAULT_ACTOR,
    });
  } else {
    const unverified = {
      sourceType: RateProvenanceSource.LEGACY_UNVERIFIED,
      rateCatalogueItemId: null,
      sourceBoqItemRateProvenanceId: sourceRate.id,
      currencySnapshot: sourceRate.currencySnapshot,
      sourceEffectiveDate: null,
      sourceExpiryDate: null,
      ...rateSnapshot(input.item),
      confirmedByUserId: null,
      confirmedByName: "Copied from unverified rate evidence",
      confirmedAt: null,
    };
    await tx.bOQItemRateProvenance.upsert({
      where: { boqItemId: input.item.id },
      create: {
        companyId: input.companyId,
        projectId: input.projectId,
        boqItemId: input.item.id,
        ...unverified,
      },
      update: unverified,
    });
  }
}

export async function freezeRevisionItemEvidence(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    projectId: string;
    snapshotId: string;
    items: Array<IntegrityItemValues & { itemCode: string }>;
  },
) {
  for (const item of input.items) {
    const [quantityProvenance, rateProvenance] = await Promise.all([
      tx.bOQItemQuantityProvenance.findUnique({ where: { boqItemId: item.id } }),
      tx.bOQItemRateProvenance.findUnique({ where: { boqItemId: item.id } }),
    ]);
    if (!quantityProvenance || !rateProvenance) {
      throw new Error(`BOQ item ${item.itemCode} does not have a complete provenance graph.`);
    }
    await tx.bOQRevisionItemEvidence.create({
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        boqRevisionSnapshotId: input.snapshotId,
        boqItemId: item.id,
        quantityProvenanceId: quantityProvenance.id,
        rateProvenanceId: rateProvenance.id,
        itemCodeSnapshot: item.itemCode,
        quantitySnapshot: new Prisma.Decimal(item.quantity),
        unitSnapshot: item.unit,
        unitCostSnapshot: new Prisma.Decimal(item.unitCost),
      },
    });
  }
}
