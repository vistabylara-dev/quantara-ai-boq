import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { getEffectiveEntitlements } from "@/lib/entitlements/effective-entitlement-service";
import type { CurrentActor } from "@/lib/auth/current-actor";

export type PackageRequirement = {
  packageId: string;
  packageKey: string;
  packageName: string;
  isSatisfied: boolean;
};

// Placeholder types for future expansion
export type IntegrationRequirement = any;
export type PlanRequirement = any;

export type BoqCommercialManifest = {
  companyId: string;
  projectId: string;
  boqId: string;
  revisionNumber: number;

  requestedOutputType: "BOQ";
  requestedFormat: "PDF" | "DOCX" | "XLSX" | "CSV" | "HTML" | "TECHNICAL_REPORT";

  premiumMasterItemIds: string[];
  packageRequirements: PackageRequirement[];
  integrationRequirements: IntegrationRequirement[];
  planRequirements: PlanRequirement[];

  allCommercialRequirementsSatisfied: boolean;
  manifestFingerprint: string;
};

export async function generateBoqCommercialManifest(
  companyId: string,
  projectId: string,
  boqId: string,
  revisionNumber: number,
  requestedOutputType: "BOQ",
  requestedFormat: "PDF" | "DOCX" | "XLSX" | "CSV" | "HTML" | "TECHNICAL_REPORT",
): Promise<BoqCommercialManifest> {
  const currentBoq = await prisma.bOQ.findUnique({ where: { id: boqId }, select: { revisionNumber: true } });
  let uniqueMasterItemIds: string[] = [];

  if (currentBoq?.revisionNumber === revisionNumber) {
    const boqItems = await prisma.bOQItem.findMany({
      where: {
        section: { boqId },
        sourceMasterItemId: { not: null },
      },
      select: { sourceMasterItemId: true },
    });
    uniqueMasterItemIds = Array.from(new Set(boqItems.map((item) => item.sourceMasterItemId!)));
  } else {
    const snapshot = await prisma.bOQRevisionSnapshot.findFirst({
      where: { boqId, revisionNumber },
    });
    if (snapshot) {
      const parsed = snapshot.snapshotJson as any;
      const ids = new Set<string>();
      if (parsed?.sections) {
        for (const sec of parsed.sections) {
          if (sec.items) {
            for (const item of sec.items) {
              if (item.sourceMasterItemId) ids.add(item.sourceMasterItemId);
            }
          }
        }
      }
      uniqueMasterItemIds = Array.from(ids);
    }
  }

  if (uniqueMasterItemIds.length === 0) {
    return createEmptyManifest(companyId, projectId, boqId, revisionNumber, requestedOutputType, requestedFormat);
  }

  // 2. Resolve Premium Packages
  const masterItems = await prisma.masterItem.findMany({
    where: {
      id: { in: uniqueMasterItemIds },
      isPremium: true,
    },
    include: {
      packageItems: {
        include: {
          package: true,
        },
      },
    },
  });

  const premiumMasterItemIds = Array.from(new Set(masterItems.map((mi) => mi.id)));
  
  if (premiumMasterItemIds.length === 0) {
    return createEmptyManifest(companyId, projectId, boqId, revisionNumber, requestedOutputType, requestedFormat);
  }

  // Find all packages that cover the premium items used.
  // We want the minimal set of packages, or simply require that *every* premium item 
  // is covered by at least one package the user is subscribed to.
  // For the manifest, we will list ALL packages that cover the used items.
  const packageMap = new Map<string, { id: string; key: string; name: string }>();
  for (const mi of masterItems) {
    for (const pi of mi.packageItems) {
      packageMap.set(pi.package.id, {
        id: pi.package.id,
        key: pi.package.key,
        name: pi.package.name,
      });
    }
  }

  // 3. Evaluate active subscriptions for the Company
  const activeSubscriptions = await prisma.companyPackageSubscription.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      packageId: { in: Array.from(packageMap.keys()) },
      OR: [
        { expiresAt: { gt: new Date() } },
        { expiresAt: null },
      ],
    },
  });
  
  const satisfiedPackageIds = new Set(activeSubscriptions.map((sub) => sub.packageId));

  const packageRequirements: PackageRequirement[] = Array.from(packageMap.values()).map((pkg) => ({
    packageId: pkg.id,
    packageKey: pkg.key,
    packageName: pkg.name,
    isSatisfied: satisfiedPackageIds.has(pkg.id),
  }));

  // Check if every premium item is covered by at least one satisfied package
  let allSatisfied = true;
  for (const mi of masterItems) {
    if (mi.packageItems.length === 0) {
      // If a premium item is in no package, it can't be unlocked! We should block it, or 
      // maybe it's not actually sold in packages. For Canva style, it's blocked.
      allSatisfied = false;
      break;
    }
    const isCovered = mi.packageItems.some((pi) => satisfiedPackageIds.has(pi.package.id));
    if (!isCovered) {
      allSatisfied = false;
      break;
    }
  }

  // 4. Fingerprint the commercial manifest state
  const fingerprintPayload = {
    companyId,
    projectId,
    boqId,
    revisionNumber,
    requestedOutputType,
    requestedFormat,
    packageRequirements: packageRequirements.map((r) => ({ id: r.packageId, satisfied: r.isSatisfied })).sort((a, b) => a.id.localeCompare(b.id)),
  };

  const manifestFingerprint = createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex");

  return {
    companyId,
    projectId,
    boqId,
    revisionNumber,
    requestedOutputType,
    requestedFormat,
    premiumMasterItemIds,
    packageRequirements,
    integrationRequirements: [],
    planRequirements: [],
    allCommercialRequirementsSatisfied: allSatisfied,
    manifestFingerprint,
  };
}

function createEmptyManifest(
  companyId: string,
  projectId: string,
  boqId: string,
  revisionNumber: number,
  requestedOutputType: "BOQ",
  requestedFormat: "PDF" | "DOCX" | "XLSX" | "CSV" | "HTML" | "TECHNICAL_REPORT",
): BoqCommercialManifest {
  const fingerprintPayload = {
    companyId,
    projectId,
    boqId,
    revisionNumber,
    requestedOutputType,
    requestedFormat,
    packageRequirements: [],
  };

  return {
    companyId,
    projectId,
    boqId,
    revisionNumber,
    requestedOutputType,
    requestedFormat,
    premiumMasterItemIds: [],
    packageRequirements: [],
    integrationRequirements: [],
    planRequirements: [],
    allCommercialRequirementsSatisfied: true,
    manifestFingerprint: createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex"),
  };
}

export async function assertCleanOutputAuthorized(
  companyId: string,
  projectId: string,
  boqId: string,
  revisionNumber: number,
  requestedFormat: "PDF" | "DOCX" | "XLSX" | "CSV" | "HTML" | "TECHNICAL_REPORT",
) {
  const manifest = await generateBoqCommercialManifest(
    companyId,
    projectId,
    boqId,
    revisionNumber,
    "BOQ",
    requestedFormat
  );

  if (!manifest.allCommercialRequirementsSatisfied) {
    throw new AppError(
      "COMMERCIAL_UNLOCK_REQUIRED",
      "This BOQ contains premium items that require an active subscription for clean output generation.",
      403,
      { manifestFingerprint: [manifest.manifestFingerprint] }
    );
  }
}

export async function assertCleanOutputAuthorizedEffective(
  actor: Pick<CurrentActor, "userId" | "companyId">,
  projectId: string,
  boqId: string,
  revisionNumber: number,
  requestedFormat: "PDF" | "DOCX" | "XLSX" | "CSV" | "HTML" | "TECHNICAL_REPORT"
) {
  const effective = await getEffectiveEntitlements(actor);
  if (effective.source === "owner-override") {
    return;
  }
  await assertCleanOutputAuthorized(actor.companyId, projectId, boqId, revisionNumber, requestedFormat);
}
