import type { CurrentActor } from "@/lib/auth/current-actor";
import {
  getCompanyActivity,
  getCompanyDashboardMetrics,
  getCompanySubscriptionSummary,
  getRecentBoqs,
  getRecentClients,
  getRecentDocuments,
  getRecentFiles,
  getRecentProjects,
} from "@/lib/repositories/company-dashboard-repository";

/**
 * Thin service layer: derives companyId only from the authenticated actor
 * (never from request input) and forwards to the repository. Matches the
 * existing dashboard routes' convention (commercial-summary,
 * proposal-summary) of not requiring an extra capability beyond being an
 * authenticated member of the company — every company role can view its
 * own dashboard.
 */
export async function getDashboardMetrics(actor: CurrentActor) {
  return getCompanyDashboardMetrics(actor.companyId);
}

export async function listRecentProjects(actor: CurrentActor) {
  return getRecentProjects(actor.companyId);
}

export async function listRecentBoqs(actor: CurrentActor) {
  return getRecentBoqs(actor.companyId);
}

export async function listRecentFiles(actor: CurrentActor) {
  return getRecentFiles(actor.companyId);
}

export async function listRecentDocuments(actor: CurrentActor) {
  return getRecentDocuments(actor.companyId);
}

export async function listRecentClients(actor: CurrentActor) {
  return getRecentClients(actor.companyId);
}

export async function listCompanyActivity(actor: CurrentActor) {
  return getCompanyActivity(actor.companyId);
}

export async function getSubscriptionSummary(actor: CurrentActor) {
  return getCompanySubscriptionSummary(actor.companyId);
}
