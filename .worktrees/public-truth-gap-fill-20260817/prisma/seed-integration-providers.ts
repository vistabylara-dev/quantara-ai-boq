import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
/**
 * INTEGRATIONS-1A — seeds the IntegrationProvider table from the code-side
 * provider registry (src/lib/integrations/provider-registry.ts). The
 * marketplace UI never depends on this table (it reads the registry
 * directly), so this is purely to give ExternalConnection a real FK target
 * ahead of 1B+. Idempotent — upserts by id, safe to re-run any time the
 * registry changes.
 *
 * Usage: npx tsx prisma/seed-integration-providers.ts
 */
import { PROVIDER_REGISTRY } from "../src/lib/integrations/provider-registry";

const prisma = createDirectPrismaClient();

async function main(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const provider of PROVIDER_REGISTRY) {
    const existing = await prisma.integrationProvider.findUnique({ where: { id: provider.id } });
    await prisma.integrationProvider.upsert({
      where: { id: provider.id },
      update: {
        providerFamily: provider.providerFamily,
        displayName: provider.displayName,
        category: provider.category,
        connectionType: provider.connectionType,
        status: provider.status,
        sortOrder: provider.recommendedOrder ?? 0,
      },
      create: {
        id: provider.id,
        providerFamily: provider.providerFamily,
        displayName: provider.displayName,
        category: provider.category,
        connectionType: provider.connectionType,
        status: provider.status,
        sortOrder: provider.recommendedOrder ?? 0,
      },
    });
    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`IntegrationProvider seed complete: ${created} created, ${updated} updated, ${PROVIDER_REGISTRY.length} total.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
