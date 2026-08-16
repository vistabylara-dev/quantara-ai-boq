import {
  ExtractedEntityStatus,
  PlatformRole,
  Prisma,
  ProjectFileStatus,
  TayqanHirePlan,
  TayqanHireStatus,
  TayqanIntakeMessageRole,
  TayqanIntakeStatus,
  type TayqanHireEntitlement,
  type TayqanIntakeSession,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { getTayqanMaxDistinctProjects } from "@/lib/tayqan/tayqan-commerce";

export type TayqanQuestionOption = {
  value: string;
  label?: string;
  labelKey?: string;
};

export type TayqanIntakeQuestion = {
  key: string;
  i18nKey: string;
  inputType: "choice" | "text" | "action";
  options?: TayqanQuestionOption[];
  vars?: Record<string, string | number>;
  actionHref?: string;
};

export const TAYQAN_PROJECT_CATEGORIES = [
  "BUILDING",
  "FIT_OUT",
  "INFRASTRUCTURE",
  "MEP_SERVICES",
  "LANDSCAPE_EXTERNAL",
  "OTHER",
] as const;

export type TayqanProjectCategory =
  (typeof TAYQAN_PROJECT_CATEGORIES)[number];

export type TayqanIntakeConversationContext = {
  projectCategory: TayqanProjectCategory | null;
  categoryScope: string | null;
};

const EMPTY_TAYQAN_INTAKE_CONTEXT:
  TayqanIntakeConversationContext = {
    projectCategory: null,
    categoryScope: null,
  };

const TAYQAN_CATEGORY_SCOPE_OPTIONS:
  Partial<
    Record<
      TayqanProjectCategory,
      readonly TayqanQuestionOption[]
    >
  > = {

  BUILDING: [
    {
      value: "FULL_BUILDING",
      labelKey: "tayqan.hire.options.scopeFullBuilding",
    },
    {
      value: "ARCHITECTURAL",
      labelKey: "tayqan.hire.options.scopeArchitectural",
    },
    {
      value: "STRUCTURAL",
      labelKey: "tayqan.hire.options.scopeStructural",
    },
    {
      value: "MEP",
      labelKey: "tayqan.hire.options.scopeMep",
    },
  ],

  FIT_OUT: [
    {
      value: "FULL_FIT_OUT",
      labelKey: "tayqan.hire.options.scopeFullFitOut",
    },
    {
      value: "ARCHITECTURAL_FINISHES",
      labelKey:
        "tayqan.hire.options.scopeArchitecturalFinishes",
    },
    {
      value: "JOINERY",
      labelKey: "tayqan.hire.options.scopeJoinery",
    },
    {
      value: "MEP",
      labelKey: "tayqan.hire.options.scopeMep",
    },
  ],

  INFRASTRUCTURE: [
    {
      value: "FULL_INFRASTRUCTURE",
      labelKey:
        "tayqan.hire.options.scopeFullInfrastructure",
    },
    {
      value: "EARTHWORKS_ROADS",
      labelKey:
        "tayqan.hire.options.scopeEarthworksRoads",
    },
    {
      value: "UTILITIES_DRAINAGE",
      labelKey:
        "tayqan.hire.options.scopeUtilitiesDrainage",
    },
    {
      value: "EXTERNAL_WORKS",
      labelKey:
        "tayqan.hire.options.scopeExternalWorks",
    },
  ],

  MEP_SERVICES: [
    {
      value: "FULL_MEP",
      labelKey: "tayqan.hire.options.scopeFullMep",
    },
    {
      value: "HVAC",
      labelKey: "tayqan.hire.options.scopeHvac",
    },
    {
      value: "ELECTRICAL_ELV",
      labelKey:
        "tayqan.hire.options.scopeElectricalElv",
    },
    {
      value: "PLUMBING_FIRE",
      labelKey:
        "tayqan.hire.options.scopePlumbingFire",
    },
  ],

  LANDSCAPE_EXTERNAL: [
    {
      value: "FULL_LANDSCAPE",
      labelKey:
        "tayqan.hire.options.scopeFullLandscape",
    },
    {
      value: "HARDSCAPE",
      labelKey: "tayqan.hire.options.scopeHardscape",
    },
    {
      value: "SOFTSCAPE",
      labelKey: "tayqan.hire.options.scopeSoftscape",
    },
    {
      value: "IRRIGATION",
      labelKey: "tayqan.hire.options.scopeIrrigation",
    },
  ],
};

function isTayqanProjectCategory(
  value: string,
): value is TayqanProjectCategory {
  return (
    TAYQAN_PROJECT_CATEGORIES as readonly string[]
  ).includes(value);
}

function categoryScopeOptions(
  category: TayqanProjectCategory,
): readonly TayqanQuestionOption[] {
  return TAYQAN_CATEGORY_SCOPE_OPTIONS[category] ?? [];
}

export type TayqanProjectSnapshot = {
  project: {
    id: string;
    slug: string;
    name: string;
    reference: string;
    description: string | null;
    location: string | null;
  };
  boqs: Array<{
    id: string;
    title: string;
    revisionNumber: number;
    version: number;
    status: string;
  }>;
  files: Array<{
    id: string;
    originalName: string;
    extension: string;
    classification: string;
    status: string;
    drawingNumber: string | null;
    drawingTitle: string | null;
    revisionNumber: string | null;
    measurementUnit: string | null;
  }>;
  ambiguousDrawingGroups: Array<{
    drawingNumber: string;
    revisions: string[];
    fileIds: string[];
  }>;
  extractedEntityCount: number;
  confirmedEntityCount: number;
};

const ACTIVE_HIRE_STATUSES = [TayqanHireStatus.ACTIVE] as const;

export const TAYQAN_INTERNAL_ADMIN_PRICE_CODE =
  "tayqan_internal_admin";

export type TayqanAccessMode =
  | "PAID"
  | "INTERNAL_ADMIN";

export type TayqanProjectQuota = {
  maxProjects: number | null;
  usedProjects: number;
  remainingProjects: number | null;
  currentProjectAssigned: boolean;
  canAssignCurrentProject: boolean;
};

export function isTayqanInternalAdminRole(
  role: PlatformRole | null,
): boolean {
  return (
    role === PlatformRole.PLATFORM_OWNER
    || role === PlatformRole.PLATFORM_ADMIN
  );
}

export function deriveTayqanProjectQuota(
  maxProjects: number | null,
  assignedProjectIds: readonly string[],
  currentProjectId: string,
): TayqanProjectQuota {
  const assigned =
    new Set(assignedProjectIds);

  const usedProjects =
    assigned.size;

  const currentProjectAssigned =
    assigned.has(currentProjectId);

  const remainingProjects =
    maxProjects === null
      ? null
      : Math.max(
          0,
          maxProjects - usedProjects,
        );

  return {
    maxProjects,
    usedProjects,
    remainingProjects,
    currentProjectAssigned,

    canAssignCurrentProject:
      currentProjectAssigned
      || maxProjects === null
      || usedProjects < maxProjects,
  };
}

function serializeSnapshot(snapshot: TayqanProjectSnapshot): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonObject;
}

function intakeAnswerQuestionKey(
  value: Prisma.JsonValue | null,
): string | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const questionKey =
    (value as Record<string, unknown>).questionKey;

  return typeof questionKey === "string"
    ? questionKey
    : null;
}

export function deriveTayqanIntakeConversationContext(
  messages: ReadonlyArray<{
    message: string;
    structuredDataJson: Prisma.JsonValue | null;
  }>,
): TayqanIntakeConversationContext {

  let projectCategory:
    TayqanProjectCategory | null = null;

  let categoryScope: string | null = null;

  for (const message of messages) {
    const questionKey =
      intakeAnswerQuestionKey(
        message.structuredDataJson,
      );

    const answer = message.message.trim();

    if (!answer) continue;

    if (
      questionKey === "project_category" &&
      isTayqanProjectCategory(answer)
    ) {
      projectCategory = answer;

      // A changed category invalidates any earlier scope.
      categoryScope = null;
    }
    else if (
      questionKey === "category_scope"
    ) {
      categoryScope = answer;
    }
  }

  return {
    projectCategory,
    categoryScope,
  };
}

export async function
getTayqanIntakeConversationContext(
  companyId: string,
  sessionId: string,
): Promise<TayqanIntakeConversationContext> {

  const messages =
    await prisma.tayqanIntakeMessage.findMany({
      where: {
        companyId,
        sessionId,
        role: TayqanIntakeMessageRole.USER,
      },

      orderBy: {
        createdAt: "asc",
      },

      select: {
        message: true,
        structuredDataJson: true,
      },
    });

  return deriveTayqanIntakeConversationContext(
    messages,
  );
}

export async function expireStaleTayqanHires(companyId: string, now = new Date()): Promise<void> {
  await prisma.tayqanHireEntitlement.updateMany({
    where: {
      companyId,
      status: TayqanHireStatus.ACTIVE,
      expiresAt: { lte: now },
    },
    data: { status: TayqanHireStatus.EXPIRED },
  });
}

export async function getActiveTayqanEntitlement(
  companyId: string,
  now = new Date(),
): Promise<TayqanHireEntitlement | null> {
  await expireStaleTayqanHires(companyId, now);
  return prisma.tayqanHireEntitlement.findFirst({
    where: {
      companyId,
      status: { in: [...ACTIVE_HIRE_STATUSES] },
      priceCode: {
        not: TAYQAN_INTERNAL_ADMIN_PRICE_CODE,
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function assertActiveTayqanEntitlement(
  companyId: string,
  now = new Date(),
): Promise<TayqanHireEntitlement> {
  const entitlement = await getActiveTayqanEntitlement(companyId, now);
  if (!entitlement) {
    throw new AppError(
      "TAYQAN_HIRE_REQUIRED",
      "An active TAYQAN hire is required before TAYQAN can work.",
      402,
    );
  }
  return entitlement;
}

async function actorHasInternalTayqanAccess(
  actor: CurrentActor,
): Promise<boolean> {
  const user =
    await prisma.user.findFirst({
      where: {
        id: actor.userId,
        companyId: actor.companyId,
        isActive: true,
      },

      select: {
        platformRole: true,
        emailVerifiedAt: true,
      },
    });

  const hasInternalAdminRole = Boolean(
    user?.emailVerifiedAt
    && isTayqanInternalAdminRole(
      user.platformRole,
    ),
  );

  if (!hasInternalAdminRole) {
    return false;
  }

  const activeSimulation =
    await prisma.platformSimulationSession.findUnique({
      where: {
        userId: actor.userId,
      },
      select: {
        id: true,
      },
    });

  return !activeSimulation;
}

async function getOrCreateTayqanInternalAdminEntitlement(
  actor: CurrentActor,
  now = new Date(),
): Promise<TayqanHireEntitlement | null> {
  if (
    !await actorHasInternalTayqanAccess(
      actor,
    )
  ) {
    return null;
  }

  const lockKey =
    `tayqan-internal-admin:${actor.userId}`;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${lockKey})
        )
      `;

      const existing =
        await tx.tayqanHireEntitlement
          .findFirst({
            where: {
              companyId: actor.companyId,
              purchasedByUserId:
                actor.userId,

              priceCode:
                TAYQAN_INTERNAL_ADMIN_PRICE_CODE,

              status:
                TayqanHireStatus.ACTIVE,
            },

            orderBy: {
              createdAt: "desc",
            },
          });

      if (existing) {
        return existing;
      }

      return tx.tayqanHireEntitlement
        .create({
          data: {
            companyId:
              actor.companyId,

            purchasedByUserId:
              actor.userId,

            /*
             * Existing enum only. This is NOT a
             * CommercePrice and never enters Stripe.
             * AccessMode remains INTERNAL_ADMIN.
             */
            plan:
              TayqanHirePlan.MONTHLY,

            status:
              TayqanHireStatus.ACTIVE,

            priceCode:
              TAYQAN_INTERNAL_ADMIN_PRICE_CODE,

            startsAt: now,
            expiresAt: null,
          },
        });
    },
  );
}

export async function getTayqanAccess(
  actor: CurrentActor,
  now = new Date(),
): Promise<{
  entitlement: TayqanHireEntitlement;
  accessMode: TayqanAccessMode;
} | null> {
  const internal =
    await getOrCreateTayqanInternalAdminEntitlement(
      actor,
      now,
    );

  if (internal) {
    return {
      entitlement: internal,
      accessMode: "INTERNAL_ADMIN",
    };
  }

  const paid =
    await getActiveTayqanEntitlement(
      actor.companyId,
      now,
    );

  return paid
    ? {
        entitlement: paid,
        accessMode: "PAID",
      }
    : null;
}

export async function assertTayqanAccessEntitlement(
  actor: CurrentActor,
  now = new Date(),
): Promise<TayqanHireEntitlement> {
  const access =
    await getTayqanAccess(
      actor,
      now,
    );

  if (!access) {
    throw new AppError(
      "TAYQAN_HIRE_REQUIRED",
      "An active TAYQAN hire is required before TAYQAN can work.",
      402,
    );
  }

  return access.entitlement;
}

async function getTayqanProjectQuota(
  entitlement: TayqanHireEntitlement,
  currentProjectId: string,
): Promise<TayqanProjectQuota> {
  const sessions =
    await prisma.tayqanIntakeSession
      .findMany({
        where: {
          companyId:
            entitlement.companyId,

          hireEntitlementId:
            entitlement.id,
        },

        select: {
          projectId: true,
        },
      });

  const maxProjects =
    entitlement.priceCode
      === TAYQAN_INTERNAL_ADMIN_PRICE_CODE
      ? null
      : getTayqanMaxDistinctProjects(
          entitlement.plan,
        );

  return deriveTayqanProjectQuota(
    maxProjects,

    sessions.map(
      (session) =>
        session.projectId,
    ),

    currentProjectId,
  );
}
export async function buildTayqanProjectSnapshot(
  actor: CurrentActor,
  projectIdentifier: string,
): Promise<TayqanProjectSnapshot> {
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  const [boqs, files, extractedEntityCount, confirmedEntityCount] = await Promise.all([
    prisma.bOQ.findMany({
      where: { companyId: actor.companyId, projectId: project.id },
      orderBy: [{ revisionNumber: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        revisionNumber: true,
        version: true,
        status: true,
      },
    }),
    prisma.projectFile.findMany({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        status: { not: ProjectFileStatus.ARCHIVED },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        extension: true,
        classification: true,
        status: true,
        drawingNumber: true,
        drawingTitle: true,
        revisionNumber: true,
        measurementUnit: true,
      },
    }),
    prisma.extractedEntity.count({
      where: { companyId: actor.companyId, projectId: project.id },
    }),
    prisma.extractedEntity.count({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        status: {
          in: [
            ExtractedEntityStatus.CONFIRMED,
            ExtractedEntityStatus.CORRECTED,
            ExtractedEntityStatus.IMPORTED,
          ],
        },
      },
    }),
  ]);

  const groups = new Map<string, { revisions: Set<string>; fileIds: string[] }>();
  for (const file of files) {
    const drawingNumber = file.drawingNumber?.trim();
    if (!drawingNumber) continue;
    const entry = groups.get(drawingNumber) ?? { revisions: new Set<string>(), fileIds: [] };
    entry.fileIds.push(file.id);
    entry.revisions.add(file.revisionNumber?.trim() || "UNSPECIFIED");
    groups.set(drawingNumber, entry);
  }

  const ambiguousDrawingGroups = [...groups.entries()]
    .filter(([, value]) => value.revisions.size > 1)
    .map(([drawingNumber, value]) => ({
      drawingNumber,
      revisions: [...value.revisions],
      fileIds: value.fileIds,
    }));

  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      reference: project.reference,
      description: project.description,
      location: project.location,
    },
    boqs: boqs.map((boq) => ({
      ...boq,
      status: boq.status,
    })),
    files: files.map((file) => ({
      ...file,
      classification: file.classification,
      status: file.status,
    })),
    ambiguousDrawingGroups,
    extractedEntityCount,
    confirmedEntityCount,
  };
}

function deliverableNeedsExistingBoq(deliverable: string | null): boolean {
  return deliverable === "REVIEW_EXISTING_BOQ" || deliverable === "UPDATE_EXISTING_BOQ";
}

function deliverableNeedsSources(deliverable: string | null): boolean {
  return deliverable === "COMPLETE_BOQ_FROM_SOURCES" || deliverable === "QUANTITY_TAKEOFF" || deliverable === "UPDATE_EXISTING_BOQ";
}

export function deriveTayqanQuestion(
  snapshot: TayqanProjectSnapshot,
  session: Pick<
    TayqanIntakeSession,
    | "boqId"
    | "desiredDeliverable"
    | "measurementStandard"
    | "includeRates"
    | "pricingBasis"
    | "exclusions"
    | "deadlineText"
    | "specialInstructions"
    | "authoritativeSourcePolicy"
  >,
  context:
    TayqanIntakeConversationContext =
      EMPTY_TAYQAN_INTAKE_CONTEXT,
): TayqanIntakeQuestion | null {

  // TAYQAN must understand the project category
  // and responsibility scope before asking the
  // generic assignment questions.

  if (!context.projectCategory) {
    return {
      key: "project_category",
      i18nKey:
        "tayqan.hire.questions.projectCategory",
      inputType: "choice",

      options: [
        {
          value: "BUILDING",
          labelKey:
            "tayqan.hire.options.categoryBuilding",
        },
        {
          value: "FIT_OUT",
          labelKey:
            "tayqan.hire.options.categoryFitOut",
        },
        {
          value: "INFRASTRUCTURE",
          labelKey:
            "tayqan.hire.options.categoryInfrastructure",
        },
        {
          value: "MEP_SERVICES",
          labelKey:
            "tayqan.hire.options.categoryMepServices",
        },
        {
          value: "LANDSCAPE_EXTERNAL",
          labelKey:
            "tayqan.hire.options.categoryLandscapeExternal",
        },
        {
          value: "OTHER",
          labelKey:
            "tayqan.hire.options.categoryOther",
        },
      ],
    };
  }

  if (!context.categoryScope) {
    const options =
      categoryScopeOptions(
        context.projectCategory,
      );

    return {
      key: "category_scope",

      i18nKey:
        context.projectCategory === "OTHER"
          ? "tayqan.hire.questions.categoryScopeOther"
          : "tayqan.hire.questions.categoryScope",

      inputType:
        context.projectCategory === "OTHER"
          ? "text"
          : "choice",

      ...(options.length > 0
        ? { options: [...options] }
        : {}),
    };
  }

  if (!session.desiredDeliverable) {
    return {
      key: "desired_deliverable",
      i18nKey: "tayqan.hire.questions.desiredDeliverable",
      inputType: "choice",
      options: [
        { value: "COMPLETE_BOQ_FROM_SOURCES", labelKey: "tayqan.hire.options.completeBoq" },
        { value: "UPDATE_EXISTING_BOQ", labelKey: "tayqan.hire.options.updateBoq" },
        { value: "REVIEW_EXISTING_BOQ", labelKey: "tayqan.hire.options.reviewBoq" },
        { value: "QUANTITY_TAKEOFF", labelKey: "tayqan.hire.options.quantityTakeoff" },
      ],
    };
  }

  if (deliverableNeedsExistingBoq(session.desiredDeliverable) && !session.boqId) {
    if (snapshot.boqs.length === 0) {
      return {
        key: "missing_boq",
        i18nKey: "tayqan.hire.questions.missingBoq",
        inputType: "action",
        actionHref: `/projects/${snapshot.project.slug}/boq`,
      };
    }
    if (snapshot.boqs.length > 1) {
      return {
        key: "boq",
        i18nKey: "tayqan.hire.questions.selectBoq",
        inputType: "choice",
        options: snapshot.boqs.map((boq) => ({
          value: boq.id,
          label: `${boq.title} · rev ${boq.revisionNumber}`,
        })),
      };
    }
  }

  if (
    (session.desiredDeliverable === "COMPLETE_BOQ_FROM_SOURCES" || session.desiredDeliverable === "QUANTITY_TAKEOFF") &&
    !session.boqId && snapshot.boqs.length > 0
  ) {
    return {
      key: "boq",
      i18nKey: "tayqan.hire.questions.selectWorkingBoq",
      inputType: "choice",
      options: snapshot.boqs.map((boq) => ({ value: boq.id, label: `${boq.title} · rev ${boq.revisionNumber}` })),
    };
  }


  if (deliverableNeedsSources(session.desiredDeliverable) && snapshot.files.length === 0) {
    return {
      key: "upload_sources",
      i18nKey: "tayqan.hire.questions.uploadSources",
      inputType: "action",
      actionHref: `/projects/${snapshot.project.slug}/files`,
    };
  }

  if (snapshot.ambiguousDrawingGroups.length > 0 && !session.authoritativeSourcePolicy) {
    const details = snapshot.ambiguousDrawingGroups
      .slice(0, 4)
      .map((group) => `${group.drawingNumber}: ${group.revisions.join(", ")}`)
      .join(" · ");
    return {
      key: "authoritative_sources",
      i18nKey: "tayqan.hire.questions.authoritativeSources",
      inputType: "choice",
      vars: { details },
      options: [
        { value: "USE_LATEST_REVISION", labelKey: "tayqan.hire.options.useLatestRevision" },
        { value: "ASK_ON_EACH_CONFLICT", labelKey: "tayqan.hire.options.askEachConflict" },
      ],
    };
  }

  if (!session.measurementStandard && session.desiredDeliverable !== "REVIEW_EXISTING_BOQ") {
    return {
      key: "measurement_standard",
      i18nKey: "tayqan.hire.questions.measurementStandard",
      inputType: "choice",
      options: [
        { value: "NRM", label: "NRM" },
        { value: "SMM7", label: "SMM7" },
        { value: "CESMM", label: "CESMM" },
        { value: "CLIENT_STANDARD", labelKey: "tayqan.hire.options.clientStandard" },
        { value: "OTHER", labelKey: "tayqan.hire.options.otherStandard" },
      ],
    };
  }

  if (
    session.includeRates === null &&
    (session.desiredDeliverable === "COMPLETE_BOQ_FROM_SOURCES" || session.desiredDeliverable === "UPDATE_EXISTING_BOQ")
  ) {
    return {
      key: "include_rates",
      i18nKey: "tayqan.hire.questions.includeRates",
      inputType: "choice",
      options: [
        { value: "YES", labelKey: "tayqan.hire.options.quantitiesAndRates" },
        { value: "NO", labelKey: "tayqan.hire.options.quantitiesOnly" },
      ],
    };
  }

  if (session.includeRates === true && !session.pricingBasis) {
    return {
      key: "pricing_basis",
      i18nKey: "tayqan.hire.questions.pricingBasis",
      inputType: "text",
    };
  }

  if (!session.exclusions) {
    return {
      key: "exclusions",
      i18nKey: "tayqan.hire.questions.exclusions",
      inputType: "text",
    };
  }

  if (!session.deadlineText) {
    return {
      key: "deadline",
      i18nKey: "tayqan.hire.questions.deadline",
      inputType: "text",
    };
  }

  if (!session.specialInstructions) {
    return {
      key: "special_instructions",
      i18nKey: "tayqan.hire.questions.specialInstructions",
      inputType: "text",
    };
  }

  return null;
}

async function persistTayqanMessage(
  companyId: string,
  sessionId: string,
  role: TayqanIntakeMessageRole,
  message: string,
  structuredDataJson?: Prisma.InputJsonObject,
) {
  return prisma.tayqanIntakeMessage.create({
    data: {
      companyId,
      sessionId,
      role,
      message,
      structuredDataJson,
    },
  });
}

function questionStructure(question: TayqanIntakeQuestion): Prisma.InputJsonObject {
  return JSON.parse(
    JSON.stringify({
      kind: "QUESTION",
      questionKey: question.key,
      i18nKey: question.i18nKey,
      inputType: question.inputType,
      options: question.options ?? [],
      vars: question.vars ?? {},
      actionHref: question.actionHref ?? null,
    }),
  ) as Prisma.InputJsonObject;
}

async function ensureQuestionMessage(
  companyId: string,
  sessionId: string,
  question: TayqanIntakeQuestion,
): Promise<void> {
  const latest = await prisma.tayqanIntakeMessage.findFirst({
    where: { companyId, sessionId, role: TayqanIntakeMessageRole.TAYQAN },
    orderBy: { createdAt: "desc" },
  });
  const data = latest?.structuredDataJson;
  const currentKey =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).questionKey
      : null;
  if (currentKey === question.key) return;

  await persistTayqanMessage(
    companyId,
    sessionId,
    TayqanIntakeMessageRole.TAYQAN,
    question.i18nKey,
    questionStructure(question),
  );
}

async function ensureReadyMessage(companyId: string, sessionId: string): Promise<void> {
  const key = "tayqan.hire.readyMessage";
  const exists = await prisma.tayqanIntakeMessage.findFirst({
    where: {
      companyId,
      sessionId,
      role: TayqanIntakeMessageRole.TAYQAN,
      message: key,
    },
    select: { id: true },
  });
  if (exists) return;
  await persistTayqanMessage(
    companyId,
    sessionId,
    TayqanIntakeMessageRole.TAYQAN,
    key,
    { kind: "STATUS", i18nKey: key },
  );
}

async function normalizeSessionFromSnapshot(
  session: TayqanIntakeSession,
  snapshot: TayqanProjectSnapshot,
): Promise<TayqanIntakeSession> {
  const data: Prisma.TayqanIntakeSessionUpdateInput = {};
  if (
    !session.boqId &&
    deliverableNeedsExistingBoq(session.desiredDeliverable) &&
    snapshot.boqs.length === 1
  ) {
    data.boqId = snapshot.boqs[0].id;
  }
  if (session.desiredDeliverable === "QUANTITY_TAKEOFF" && session.includeRates === null) {
    data.includeRates = false;
  }
  if (Object.keys(data).length === 0) return session;
  return prisma.tayqanIntakeSession.update({ where: { id: session.id }, data });
}

async function recalculateSession(
  sessionInput: TayqanIntakeSession,
  snapshot: TayqanProjectSnapshot,
): Promise<{ session: TayqanIntakeSession; question: TayqanIntakeQuestion | null }> {
  let session = await normalizeSessionFromSnapshot(
    sessionInput,
    snapshot,
  );

  const context =
    await getTayqanIntakeConversationContext(
      session.companyId,
      session.id,
    );

  const question =
    deriveTayqanQuestion(
      snapshot,
      session,
      context,
    );
  const nextStatus = question
    ? TayqanIntakeStatus.NEEDS_INPUT
    : TayqanIntakeStatus.READY;

  if (session.status !== nextStatus && session.status !== TayqanIntakeStatus.WORK_STARTED) {
    session = await prisma.tayqanIntakeSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        completedAt: nextStatus === TayqanIntakeStatus.READY ? new Date() : null,
      },
    });
  }

  if (session.status === TayqanIntakeStatus.WORK_STARTED) {
    return { session, question: null };
  }

  if (question) await ensureQuestionMessage(session.companyId, session.id, question);
  else await ensureReadyMessage(session.companyId, session.id);

  return { session, question };
}

async function ensureIntakeSession(
  actor: CurrentActor,
  snapshot: TayqanProjectSnapshot,
  entitlement: TayqanHireEntitlement,
  preferredBoqId?: string | null,
): Promise<TayqanIntakeSession> {
  const lockKey =
    `tayqan-entitlement:${entitlement.id}`;

  const result =
    await prisma.$transaction(
      async (tx) => {
        /*
         * Serialize assignment for ONE entitlement.
         * This closes the race where two tabs could
         * both observe 1/2 then create projects 2 & 3.
         */
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${lockKey})
          )
        `;

        const existing =
          await tx.tayqanIntakeSession
            .findFirst({
              where: {
                companyId:
                  actor.companyId,

                projectId:
                  snapshot.project.id,

                hireEntitlementId:
                  entitlement.id,

                status: {
                  notIn: [
                    TayqanIntakeStatus.CANCELLED,
                    TayqanIntakeStatus.COMPLETED,
                  ],
                },
              },

              orderBy: {
                createdAt: "desc",
              },
            });

        if (existing) {
          return {
            session: existing,
            created: false,
          };
        }

        const assigned =
          await tx.tayqanIntakeSession
            .findMany({
              where: {
                companyId:
                  actor.companyId,

                hireEntitlementId:
                  entitlement.id,
              },

              select: {
                projectId: true,
              },
            });

        const maxProjects =
          entitlement.priceCode
            === TAYQAN_INTERNAL_ADMIN_PRICE_CODE
            ? null
            : getTayqanMaxDistinctProjects(
                entitlement.plan,
              );

        const quota =
          deriveTayqanProjectQuota(
            maxProjects,

            assigned.map(
              (session) =>
                session.projectId,
            ),

            snapshot.project.id,
          );

        if (
          !quota.canAssignCurrentProject
        ) {
          throw new AppError(
            "TAYQAN_PROJECT_LIMIT_REACHED",
            `TAYQAN Day Hire covers up to ${quota.maxProjects} distinct projects. Continue one of the already assigned projects or start another hire.`,
            409,
          );
        }

        let boqId:
          string | null = null;

        if (preferredBoqId) {
          const boq =
            snapshot.boqs.find(
              (candidate) =>
                candidate.id
                === preferredBoqId,
            );

          if (boq) {
            boqId = boq.id;
          }
        }

        const created =
          await tx.tayqanIntakeSession
            .create({
              data: {
                companyId:
                  actor.companyId,

                projectId:
                  snapshot.project.id,

                boqId,

                hireEntitlementId:
                  entitlement.id,

                createdByUserId:
                  actor.userId,

                status:
                  TayqanIntakeStatus.COLLECTING,

                projectSnapshotJson:
                  serializeSnapshot(
                    snapshot,
                  ),
              },
            });

        return {
          session: created,
          created: true,
        };
      },
    );

  if (result.created) {
    const openingKey =
      "tayqan.hire.intakeOpening";

    await persistTayqanMessage(
      actor.companyId,
      result.session.id,
      TayqanIntakeMessageRole.TAYQAN,
      openingKey,
      {
        kind: "STATUS",
        i18nKey: openingKey,
      },
    );
  }

  return result.session;
}

function messageDTO(message: {
  id: string;
  role: TayqanIntakeMessageRole;
  message: string;
  structuredDataJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role,
    message: message.message,
    structuredData: message.structuredDataJson,
    createdAt: message.createdAt.toISOString(),
  };
}

function entitlementDTO(entitlement: TayqanHireEntitlement) {
  return {
    id: entitlement.id,
    plan: entitlement.plan,
    status: entitlement.status,
    priceCode: entitlement.priceCode,
    startsAt: entitlement.startsAt?.toISOString() ?? null,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
  };
}

function sessionDTO(session: TayqanIntakeSession) {
  return {
    id: session.id,
    status: session.status,
    boqId: session.boqId,
    desiredDeliverable: session.desiredDeliverable,
    measurementStandard: session.measurementStandard,
    includeRates: session.includeRates,
    pricingBasis: session.pricingBasis,
    exclusions: session.exclusions,
    deadlineText: session.deadlineText,
    specialInstructions: session.specialInstructions,
    authoritativeSourcePolicy: session.authoritativeSourcePolicy,
    workerRunId: session.workerRunId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function getTayqanWorkspaceState(
  actor: CurrentActor,
  projectIdentifier: string,
  preferredBoqId?: string | null,
) {
  const snapshot = await buildTayqanProjectSnapshot(actor, projectIdentifier);

  const access =
    await getTayqanAccess(actor);

  if (!access) {
    return {
      accessMode: null,
      projectQuota: null,
      entitlement: null,
      session: null,
      messages: [],
      question: null,
      snapshot,
    };
  }

  const {
    entitlement,
    accessMode,
  } = access;

  let projectQuota =
    await getTayqanProjectQuota(
      entitlement,
      snapshot.project.id,
    );

  /*
   * Do not create an intake session for a forbidden
   * third Day-Hire project. UI can display quota state.
   */
  if (
    !projectQuota.canAssignCurrentProject
  ) {
    return {
      accessMode,
      projectQuota,
      entitlement:
        entitlementDTO(entitlement),
      session: null,
      messages: [],
      question: null,
      snapshot,
    };
  }

  let session = await ensureIntakeSession(
    actor,
    snapshot,
    entitlement,
    preferredBoqId,
  );

  projectQuota =
    await getTayqanProjectQuota(
      entitlement,
      snapshot.project.id,
    );
  const nextSnapshotJson = serializeSnapshot(snapshot);
  if (JSON.stringify(session.projectSnapshotJson ?? null) !== JSON.stringify(nextSnapshotJson)) {
    session = await prisma.tayqanIntakeSession.update({
      where: { id: session.id },
      data: { projectSnapshotJson: nextSnapshotJson },
    });
  }
  const recalculated = await recalculateSession(session, snapshot);
  const messages = await prisma.tayqanIntakeMessage.findMany({
    where: { companyId: actor.companyId, sessionId: recalculated.session.id },
    orderBy: { createdAt: "asc" },
  });

  return {
    accessMode,
    projectQuota,
    entitlement: entitlementDTO(entitlement),
    session: sessionDTO(recalculated.session),
    messages: messages.map(messageDTO),
    question: recalculated.question,
    snapshot,
  };
}

const DELIVERABLES = new Set([
  "COMPLETE_BOQ_FROM_SOURCES",
  "UPDATE_EXISTING_BOQ",
  "REVIEW_EXISTING_BOQ",
  "QUANTITY_TAKEOFF",
]);

export async function answerTayqanIntakeQuestion(
  actor: CurrentActor,
  projectIdentifier: string,
  input: { sessionId: string; questionKey: string; answer: string },
) {
  const entitlement = await assertTayqanAccessEntitlement(actor);
  const snapshot = await buildTayqanProjectSnapshot(actor, projectIdentifier);
  let session = await prisma.tayqanIntakeSession.findFirst({
    where: {
      id: input.sessionId,
      companyId: actor.companyId,
      projectId: snapshot.project.id,
      hireEntitlementId: entitlement.id,
    },
  });
  if (!session) throw new NotFoundError("TAYQAN intake session not found.");
  if (session.status === TayqanIntakeStatus.WORK_STARTED) {
    throw new ConflictError("TAYQAN_WORK_ALREADY_STARTED", "TAYQAN has already started this assignment.");
  }

  session =
    await normalizeSessionFromSnapshot(
      session,
      snapshot,
    );

  const context =
    await getTayqanIntakeConversationContext(
      session.companyId,
      session.id,
    );

  const current =
    deriveTayqanQuestion(
      snapshot,
      session,
      context,
    );
  if (!current || current.key !== input.questionKey) {
    throw new ConflictError(
      "TAYQAN_QUESTION_STALE",
      "The TAYQAN question changed because the project state was updated. Refresh and answer the current question.",
    );
  }

  const answer = input.answer.trim();
  const data: Prisma.TayqanIntakeSessionUpdateInput = {};

  switch (input.questionKey) {

    case "project_category":
      if (!isTayqanProjectCategory(answer)) {
        throw new AppError(
          "INVALID_TAYQAN_ANSWER",
          "Choose a supported project category.",
          400,
        );
      }
      break;

    case "category_scope": {
      if (!context.projectCategory) {
        throw new ConflictError(
          "TAYQAN_QUESTION_STALE",
          "Choose the project category before defining the category scope.",
        );
      }

      const options =
        categoryScopeOptions(
          context.projectCategory,
        );

      if (
        context.projectCategory !== "OTHER" &&
        !options.some(
          (option) => option.value === answer,
        )
      ) {
        throw new AppError(
          "INVALID_TAYQAN_ANSWER",
          "Choose a scope that matches this project category.",
          400,
        );
      }

      break;
    }

    case "desired_deliverable":
      if (!DELIVERABLES.has(answer)) throw new AppError("INVALID_TAYQAN_ANSWER", "Choose a supported TAYQAN deliverable.", 400);
      data.desiredDeliverable = answer;
      break;
    case "boq": {
      if (!snapshot.boqs.some((boq) => boq.id === answer)) throw new AppError("INVALID_TAYQAN_ANSWER", "Choose a BOQ from this project.", 400);
      data.boqId = answer;
      break;
    }
    case "authoritative_sources":
      if (!["USE_LATEST_REVISION", "ASK_ON_EACH_CONFLICT"].includes(answer)) {
        throw new AppError("INVALID_TAYQAN_ANSWER", "Choose how TAYQAN should handle source revision conflicts.", 400);
      }
      data.authoritativeSourcePolicy = answer;
      break;
    case "measurement_standard":
      data.measurementStandard = answer;
      break;
    case "include_rates":
      if (answer !== "YES" && answer !== "NO") throw new AppError("INVALID_TAYQAN_ANSWER", "Choose whether rates are included.", 400);
      data.includeRates = answer === "YES";
      break;
    case "pricing_basis":
      data.pricingBasis = answer;
      break;
    case "exclusions":
      data.exclusions = answer;
      break;
    case "deadline":
      data.deadlineText = answer;
      break;
    case "special_instructions":
      data.specialInstructions = answer;
      break;
    case "upload_sources":
      if (snapshot.files.length === 0) {
        throw new AppError("TAYQAN_SOURCES_REQUIRED", "Upload project sources before continuing.", 409);
      }
      break;
    case "missing_boq":
      if (snapshot.boqs.length === 0) {
        throw new AppError("TAYQAN_BOQ_REQUIRED", "Create a BOQ before continuing with this assignment type.", 409);
      }
      break;
    default:
      throw new AppError("INVALID_TAYQAN_QUESTION", "This TAYQAN question is not supported.", 400);
  }

  await persistTayqanMessage(
    actor.companyId,
    session.id,
    TayqanIntakeMessageRole.USER,
    answer,
    { kind: "ANSWER", questionKey: input.questionKey },
  );

  session = await prisma.tayqanIntakeSession.update({
    where: { id: session.id },
    data: {
      ...data,
      projectSnapshotJson: serializeSnapshot(snapshot),
      status: TayqanIntakeStatus.COLLECTING,
      completedAt: null,
    },
  });

  return getTayqanWorkspaceState(actor, snapshot.project.slug, session.boqId);
}

export async function assertPaidTayqanReviewAccess(
  actor: CurrentActor,
  boqId: string,
): Promise<TayqanIntakeSession> {
  const entitlement = await assertTayqanAccessEntitlement(actor);
  const boq = await prisma.bOQ.findFirst({
    where: { id: boqId, companyId: actor.companyId },
    select: { id: true, projectId: true },
  });
  if (!boq) throw new NotFoundError("BOQ not found.");

  const session = await prisma.tayqanIntakeSession.findFirst({
    where: {
      companyId: actor.companyId,
      projectId: boq.projectId,
      boqId,
      hireEntitlementId: entitlement.id,
      status: { in: [TayqanIntakeStatus.READY, TayqanIntakeStatus.WORK_STARTED] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!session) {
    throw new AppError(
      "TAYQAN_INTAKE_REQUIRED",
      "Complete the TAYQAN intake before starting a worker review.",
      409,
    );
  }
  return session;
}

export async function markPaidTayqanReviewStarted(
  sessionId: string,
  workerRunId: string,
): Promise<void> {
  await prisma.tayqanIntakeSession.update({
    where: { id: sessionId },
    data: {
      status: TayqanIntakeStatus.WORK_STARTED,
      workerRunId,
      completedAt: new Date(),
    },
  });
}

export function tayqanPlanDurationHours(plan: TayqanHirePlan): number | null {
  if (plan === TayqanHirePlan.DAY) return 24;
  if (plan === TayqanHirePlan.WEEK) return 24 * 7;
  return null;
}
