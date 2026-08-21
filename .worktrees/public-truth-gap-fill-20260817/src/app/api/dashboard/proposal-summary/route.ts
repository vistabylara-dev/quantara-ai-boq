import { ClientProposalStatus } from "@prisma/client";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { setActorContext, withActorRequestContext } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const PENDING_STATUSES: ClientProposalStatus[] = [
  ClientProposalStatus.SENT,
  ClientProposalStatus.OPENED,
  ClientProposalStatus.COMMENTED,
];

/** Counts only — never loads proposal or event rows, so this stays cheap regardless of proposal/event volume. */
async function GETHandler() {
  try {
    const actor = await getCurrentActor();
    setActorContext(actor);
    const companyId = actor.companyId;

    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [pending, sent, approved, revisionRequested, expiringWithin7Days, statusCounts] = await Promise.all([
      prisma.clientProposal.count({ where: { companyId, status: { in: PENDING_STATUSES } } }),
      prisma.clientProposal.count({ where: { companyId, status: ClientProposalStatus.SENT } }),
      prisma.clientProposal.count({ where: { companyId, status: ClientProposalStatus.APPROVED } }),
      prisma.clientProposal.count({ where: { companyId, status: ClientProposalStatus.REVISION_REQUESTED } }),
      prisma.clientProposal.count({
        where: { companyId, status: { in: PENDING_STATUSES }, expiresAt: { lte: in7Days, gte: new Date() } },
      }),
      prisma.clientProposal.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    ]);

    return apiSuccess({
      pending,
      sent,
      approved,
      revisionRequested,
      expiringWithin7Days,
      byStatus: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withActorRequestContext(GETHandler);
