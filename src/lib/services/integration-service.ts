import type { CurrentActor } from "@/lib/auth/current-actor";
import { NotFoundError } from "@/lib/errors/app-error";
import { PROVIDER_REGISTRY, getProviderById, INTEGRATION_CATEGORY_LABELS } from "@/lib/integrations/provider-registry";
import { listConnectionsForCompany, listProjectIntegrations as listProjectIntegrationsRepo } from "@/lib/repositories/integration-repository";
import { getIntegrationEntitlements } from "@/lib/entitlements/integration-entitlement-service";
import { getProjectRecord } from "@/lib/repositories/project-repository";

/**
 * INTEGRATIONS-1A — the read layer the marketplace/project-integration UI
 * calls. Provider data always comes from the static registry (renders even
 * if the migration hasn't run); connection data is best-effort — if the new
 * tables don't exist yet in this environment, connections degrade to an
 * empty list rather than failing the whole page (same defensive pattern
 * MASTER-BOQ-1A needed, applied from the start here since nothing here is a
 * previously-working path to protect — this is just good practice).
 */

async function safeListConnections(companyId: string) {
  try {
    return await listConnectionsForCompany(companyId);
  } catch {
    return [];
  }
}

export async function listProvidersForCompany(actor: Pick<CurrentActor, "userId" | "companyId">) {
  const [connections, entitlements] = await Promise.all([
    safeListConnections(actor.companyId),
    getIntegrationEntitlements(actor),
  ]);
  const connectionByProviderId = new Map(connections.filter((c) => c.status !== "DISCONNECTED").map((c) => [c.providerId, c]));

  const providers = PROVIDER_REGISTRY.map((provider) => {
    const connection = connectionByProviderId.get(provider.id) ?? null;
    const isFamilyAllowed = entitlements.allowedProviderFamilies === "all" || entitlements.allowedProviderFamilies.includes(provider.providerFamily);
    return {
      ...provider,
      categoryLabel: INTEGRATION_CATEGORY_LABELS[provider.category],
      connection,
      entitled: isFamilyAllowed,
    };
  });

  return {
    providers,
    categories: INTEGRATION_CATEGORY_LABELS,
    entitlements,
  };
}

export async function getProviderDetailForCompany(actor: Pick<CurrentActor, "userId" | "companyId">, providerId: string) {
  const provider = getProviderById(providerId);
  if (!provider) throw new NotFoundError("Integration provider not found.");

  const [connections, entitlements] = await Promise.all([
    safeListConnections(actor.companyId),
    getIntegrationEntitlements(actor),
  ]);
  const connection = connections.find((c) => c.providerId === providerId && c.status !== "DISCONNECTED") ?? null;
  const isFamilyAllowed = entitlements.allowedProviderFamilies === "all" || entitlements.allowedProviderFamilies.includes(provider.providerFamily);

  return {
    ...provider,
    categoryLabel: INTEGRATION_CATEGORY_LABELS[provider.category],
    connection,
    entitled: isFamilyAllowed,
  };
}

export async function listProjectIntegrationsForActor(actor: CurrentActor, projectId: string) {
  await getProjectRecord(actor.companyId, projectId);
  try {
    return await listProjectIntegrationsRepo(actor.companyId, projectId);
  } catch {
    return [];
  }
}
