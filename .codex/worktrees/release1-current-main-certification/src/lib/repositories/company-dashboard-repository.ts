import { ClientProposalStatus, EmailDispatchStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateBOQTotals } from "@/lib/calculations/boq-calculator";

const RECENT_LIST_LIMIT = 5;
const PENDING_PROPOSAL_STATUSES: ClientProposalStatus[] = [
  ClientProposalStatus.SENT,
  ClientProposalStatus.OPENED,
  ClientProposalStatus.COMMENTED,
];

/**
 * Every function here takes companyId as its first, mandatory argument and
 * scopes every query by it — there is no code path that can read another
 * tenant's data. Callers must derive companyId from the authenticated actor
 * (getCurrentActor()), never from client-supplied input.
 */
export async function getCompanyDashboardMetrics(companyId: string) {
  const [
    activeProjects,
    totalClients,
    totalBoqs,
    totalUploadedFiles,
    totalGeneratedDocuments,
    catalogueItems,
    pendingApprovals,
    failedOperations,
  ] = await Promise.all([
    prisma.project.count({ where: { companyId, status: { not: ProjectStatus.ARCHIVED } } }),
    prisma.client.count({ where: { companyId, isArchived: false } }),
    prisma.bOQ.count({ where: { companyId } }),
    prisma.projectFile.count({ where: { companyId } }),
    prisma.generatedDocument.count({ where: { companyId } }),
    prisma.rateCatalogueItem.count({ where: { companyId } }),
    prisma.clientProposal.count({ where: { companyId, status: { in: PENDING_PROPOSAL_STATUSES } } }),
    prisma.emailDispatch.count({ where: { companyId, status: EmailDispatchStatus.FAILED } }),
  ]);

  return {
    activeProjects,
    totalClients,
    totalBoqs,
    totalUploadedFiles,
    totalGeneratedDocuments,
    catalogueItems,
    pendingApprovals,
    failedOperations,
  };
}

export async function getRecentProjects(companyId: string, limit = RECENT_LIST_LIMIT) {
  const projects = await prisma.project.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      reference: true,
      status: true,
      updatedAt: true,
      client: { select: { id: true, name: true, companyName: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  const projectIds = projects.map((project) => project.id);

  const [boqCounts, fileCounts, documentCounts] = await Promise.all([
    prisma.bOQ.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.projectFile.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.generatedDocument.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
  ]);
  const boqCountByProject = new Map(boqCounts.map((row) => [row.projectId, row._count._all]));
  const fileCountByProject = new Map(fileCounts.map((row) => [row.projectId, row._count._all]));
  const documentCountByProject = new Map(documentCounts.map((row) => [row.projectId, row._count._all]));

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    reference: project.reference,
    status: project.status,
    updatedAt: project.updatedAt.toISOString(),
    client: project.client,
    boqCount: boqCountByProject.get(project.id) ?? 0,
    fileCount: fileCountByProject.get(project.id) ?? 0,
    documentCount: documentCountByProject.get(project.id) ?? 0,
  }));
}

/**
 * Bounded to a small recent list specifically so loading each BOQ's full
 * item tree (required to reuse the real financial engine rather than
 * recompute totals here) stays cheap — this is never a full-table read.
 */
export async function getRecentBoqs(companyId: string, limit = RECENT_LIST_LIMIT) {
  const boqs = await prisma.bOQ.findMany({
    where: { companyId },
    select: {
      id: true,
      title: true,
      status: true,
      isLocked: true,
      revisionNumber: true,
      discountPercentage: true,
      taxRate: true,
      updatedAt: true,
      project: { select: { id: true, name: true, currency: true } },
      sections: { select: { items: { select: { totalAmount: true, landedCost: true, quantity: true, status: true } } } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  return boqs.map((boq) => {
    const items = boq.sections.flatMap((section) => section.items);
    const totals = calculateBOQTotals(items, boq.discountPercentage, boq.taxRate);
    return {
      id: boq.id,
      title: boq.title,
      status: boq.status,
      isLocked: boq.isLocked,
      revisionNumber: boq.revisionNumber,
      itemCount: items.length,
      subtotal: totals.subtotal.toNumber(),
      vatAmount: totals.taxAmount.toNumber(),
      grandTotal: totals.grandTotal.toNumber(),
      project: boq.project,
      updatedAt: boq.updatedAt.toISOString(),
    };
  });
}

export async function getRecentFiles(companyId: string, limit = RECENT_LIST_LIMIT) {
  const files = await prisma.projectFile.findMany({
    where: { companyId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      extension: true,
      fileSize: true,
      status: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  return files.map((file) => ({
    id: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    extension: file.extension,
    sizeBytes: file.fileSize,
    status: file.status,
    createdAt: file.createdAt.toISOString(),
    project: file.project,
  }));
}

export async function getRecentDocuments(companyId: string, limit = RECENT_LIST_LIMIT) {
  const documents = await prisma.generatedDocument.findMany({
    where: { companyId },
    select: {
      id: true,
      type: true,
      status: true,
      revisionNumber: true,
      generatedByName: true,
      createdAt: true,
      completedAt: true,
      project: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  return documents.map((document) => ({
    id: document.id,
    format: document.type,
    status: document.status,
    revisionNumber: document.revisionNumber,
    generatedByName: document.generatedByName,
    createdAt: document.createdAt.toISOString(),
    completedAt: document.completedAt?.toISOString() ?? null,
    project: document.project,
    template: document.template,
  }));
}

export async function getRecentClients(companyId: string, limit = RECENT_LIST_LIMIT) {
  const clients = await prisma.client.findMany({
    where: { companyId, isArchived: false },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  const clientIds = clients.map((client) => client.id);

  const [projectCounts, lastProjectActivity] = await Promise.all([
    prisma.project.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _count: { _all: true } }),
    prisma.project.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds } },
      _max: { updatedAt: true },
    }),
  ]);
  const projectCountByClient = new Map(projectCounts.map((row) => [row.clientId, row._count._all]));
  const lastActivityByClient = new Map(lastProjectActivity.map((row) => [row.clientId, row._max.updatedAt]));

  return clients.map((client) => ({
    id: client.id,
    name: client.companyName || client.name,
    contactName: client.name,
    email: client.email,
    createdAt: client.createdAt.toISOString(),
    projectCount: projectCountByClient.get(client.id) ?? 0,
    lastActivityAt: lastActivityByClient.get(client.id)?.toISOString() ?? null,
  }));
}

export async function getCompanyActivity(companyId: string, limit = 10) {
  const events = await prisma.auditLog.findMany({
    where: { companyId },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      actorName: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    actorName: event.actorName,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function getCompanySubscriptionSummary(companyId: string) {
  const [company, subscription] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { legalName: true, tradeName: true },
    }),
    prisma.companySoftwareSubscription.findFirst({
      where: { companyId },
      select: {
        status: true,
        trialExpiresAt: true,
        startsAt: true,
        expiresAt: true,
        softwarePlan: { select: { key: true, name: true, planType: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
  ]);

  const companyName = company?.tradeName || company?.legalName || null;

  if (!subscription) {
    return {
      companyName,
      planName: null,
      planType: null,
      status: "NONE" as const,
      trialExpiresAt: null,
      startsAt: null,
      expiresAt: null,
    };
  }

  return {
    companyName,
    planName: subscription.softwarePlan.name,
    planType: subscription.softwarePlan.planType,
    status: subscription.status,
    trialExpiresAt: subscription.trialExpiresAt?.toISOString() ?? null,
    startsAt: subscription.startsAt?.toISOString() ?? null,
    expiresAt: subscription.expiresAt?.toISOString() ?? null,
  };
}
