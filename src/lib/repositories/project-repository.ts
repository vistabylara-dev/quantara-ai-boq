import { randomUUID } from "node:crypto";
import { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { getEnabledIndustry } from "@/lib/repositories/industry-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";

type DbClient = typeof prisma | Prisma.TransactionClient;

const projectInclude = {
  client: true,
  industryEngine: true,
  _count: { select: { boqs: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export type ProjectWriteInput = {
  reference: string;
  slug?: string;
  name: string;
  description?: string | null;
  location?: string | null;
  currency: string;
  taxRate: Prisma.Decimal.Value;
  language: string;
  status?: ProjectStatus;
  clientId?: string;
  clientName?: string;
  clientEmail?: string | null;
  industryEngineId: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function formatRevision(revisionNumber: number) {
  return `R${String(revisionNumber).padStart(2, "0")}`;
}

function toFrontendStatus(status: ProjectStatus): "draft" | "active" | "review" | "approved" | "completed" {
  switch (status) {
    case ProjectStatus.DRAFT:
      return "draft";
    case ProjectStatus.ACTIVE:
    case ProjectStatus.SENT:
      return "active";
    case ProjectStatus.NEEDS_REVIEW:
    case ProjectStatus.REVISION_REQUESTED:
      return "review";
    case ProjectStatus.INTERNALLY_APPROVED:
    case ProjectStatus.CLIENT_APPROVED:
      return "approved";
    case ProjectStatus.REJECTED:
    case ProjectStatus.ARCHIVED:
      return "completed";
  }
}

export function toProjectDTO(project: ProjectRecord) {
  return {
    id: project.slug,
    databaseId: project.id,
    clientId: project.clientId,
    reference: project.reference,
    name: project.name,
    clientName: project.client.companyName ?? project.client.name,
    clientEmail: project.client.email ?? "",
    location: project.location ?? "",
    industryId: project.industryEngine.key,
    currency: project.currency,
    taxRate: project.taxRate.toNumber(),
    language: project.language,
    status: toFrontendStatus(project.status),
    currentRevision: formatRevision(project.currentRevisionNumber),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    description: project.description ?? "",
    boqCount: project._count.boqs,
  };
}

async function uniqueSlug(companyId: string, preferred: string) {
  const base = slugify(preferred) || `project-${randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 2;
  while (await prisma.project.findFirst({ where: { companyId, slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function resolveClient(
  tx: Prisma.TransactionClient,
  companyId: string,
  input: ProjectWriteInput,
) {
  if (input.clientId) {
    const client = await tx.client.findFirst({ where: { id: input.clientId, companyId } });
    if (!client) throw new NotFoundError("Client not found.");
    return client;
  }
  if (!input.clientName) {
    throw new NotFoundError("A client is required for the project.");
  }

  const existing = input.clientEmail
    ? await tx.client.findFirst({ where: { companyId, email: input.clientEmail } })
    : await tx.client.findFirst({ where: { companyId, name: input.clientName } });
  if (existing) return existing;

  return tx.client.create({
    data: {
      companyId,
      name: input.clientName,
      companyName: input.clientName,
      email: input.clientEmail,
    },
  });
}

export async function listProjects(companyId: string) {
  const projects = await prisma.project.findMany({
    where: {
      companyId,
      status: { not: ProjectStatus.ARCHIVED },
    },
    include: projectInclude,
    orderBy: { updatedAt: "desc" },
  });
  return projects.map(toProjectDTO);
}

export async function getProjectRecord(companyId: string, identifier: string, db: DbClient = prisma) {
  const project = await db.project.findFirst({
    where: isUuid(identifier) ? { companyId, id: identifier } : { companyId, slug: identifier },
    include: projectInclude,
  });
  if (!project) throw new NotFoundError("Project not found.");
  return project;
}

export async function getProject(companyId: string, identifier: string) {
  return toProjectDTO(await getProjectRecord(companyId, identifier));
}

export async function projectReferenceExists(companyId: string, reference: string): Promise<boolean> {
  const existing = await prisma.project.findFirst({ where: { companyId, reference }, select: { id: true } });
  return Boolean(existing);
}

export async function projectSlugExists(companyId: string, slug: string): Promise<boolean> {
  const existing = await prisma.project.findFirst({ where: { companyId, slug }, select: { id: true } });
  return Boolean(existing);
}

/**
 * Accepts an optional externally-managed transaction so callers (the
 * project-creation service) can create the project and its default R01 BOQ
 * atomically. Without one, this opens and commits its own transaction,
 * preserving standalone behavior for existing callers.
 */
export async function createProject(
  companyId: string,
  input: ProjectWriteInput,
  externalTx?: Prisma.TransactionClient,
) {
  const industry = await getEnabledIndustry(companyId, input.industryEngineId);
  const slug = await uniqueSlug(companyId, input.slug ?? `project-${slugify(input.reference)}`);

  const run = async (tx: Prisma.TransactionClient) => {
    const client = await resolveClient(tx, companyId, input);
    const created = await tx.project.create({
      data: {
        companyId,
        clientId: client.id,
        industryEngineId: industry.id,
        reference: input.reference,
        slug,
        name: input.name,
        description: input.description,
        location: input.location,
        currency: input.currency,
        taxRate: new Prisma.Decimal(input.taxRate),
        language: input.language,
        status: input.status ?? ProjectStatus.DRAFT,
        currentRevisionNumber: 1,
      },
      include: projectInclude,
    });
    await createAuditLog(companyId, {
      entityType: "Project",
      entityId: created.id,
      action: "PROJECT_CREATED",
      payload: { reference: created.reference, slug: created.slug, clientId: client.id },
    }, tx);
    return created;
  };

  const project = externalTx ? await run(externalTx) : await prisma.$transaction(run);
  return toProjectDTO(project);
}

export async function archiveProject(companyId: string, identifier: string) {
  const current = await getProjectRecord(companyId, identifier);
  const project = await prisma.project.update({
    where: { id: current.id, companyId },
    data: { status: ProjectStatus.ARCHIVED },
    include: projectInclude,
  });
  await createAuditLog(companyId, {
    entityType: "Project",
    entityId: project.id,
    action: "PROJECT_ARCHIVED",
    payload: { reference: project.reference },
  });
  return toProjectDTO(project);
}

export async function updateProject(
  companyId: string,
  identifier: string,
  input: Partial<ProjectWriteInput>,
) {
  const current = await getProjectRecord(companyId, identifier);
  const industry = input.industryEngineId
    ? await getEnabledIndustry(companyId, input.industryEngineId)
    : undefined;
  const project = await prisma.$transaction(async (tx) => {
    const client = input.clientId || input.clientName
      ? await resolveClient(tx, companyId, {
          ...input,
          reference: input.reference ?? current.reference,
          name: input.name ?? current.name,
          currency: input.currency ?? current.currency,
          taxRate: input.taxRate ?? current.taxRate,
          language: input.language ?? current.language,
          industryEngineId: input.industryEngineId ?? current.industryEngine.key,
        })
      : undefined;

    return tx.project.update({
      where: { id: current.id, companyId },
      data: {
        ...(input.reference !== undefined ? { reference: input.reference } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.taxRate !== undefined ? { taxRate: new Prisma.Decimal(input.taxRate) } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(industry ? { industryEngineId: industry.id } : {}),
        ...(client ? { clientId: client.id } : {}),
      },
      include: projectInclude,
    });
  });
  return toProjectDTO(project);
}
