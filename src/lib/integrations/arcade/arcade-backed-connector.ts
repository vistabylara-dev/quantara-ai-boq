import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import type {
  ExternalFile,
  ExternalProject,
  ExternalVersion,
  IntegrationConnector,
} from "@/lib/integrations/connector-types";
import { getProviderById } from "@/lib/integrations/provider-registry";
import { ArcadeRuntime, getArcadeRuntime } from "./arcade-runtime";
import type { ArcadeExternalFileSeed } from "./arcade-types";

export type ArcadeConnectionResolver = (
  externalConnectionId: string,
) => Promise<{ companyId: string; providerId: string } | null>;

async function defaultConnectionResolver(externalConnectionId: string) {
  // Keep Prisma lazy so importing the generic adapter never opens a database
  // connection. Tests and future workers can inject their own tenant resolver.
  const { prisma } = await import("@/lib/db/prisma");
  return prisma.externalConnection.findUnique({
    where: { id: externalConnectionId },
    select: { companyId: true, providerId: true },
  });
}

function unsupported(method: string): never {
  throw new AppError(
    "ARCADE_CAPABILITY_NOT_SUPPORTED",
    `The Arcade-backed connector does not support ${method}.`,
    501,
  );
}

function readOptionalString(
  record: Record<string, unknown>,
  key: "sourceVersion" | "sourceTimestamp",
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(
      "ARCADE_INVALID_RESPONSE",
      "The integration provider returned invalid file data.",
      502,
    );
  }
  return value;
}

function normalizeExternalFileSeeds(providerId: string, value: unknown): ExternalFile[] {
  if (!Array.isArray(value)) {
    throw new AppError(
      "ARCADE_INVALID_RESPONSE",
      "The integration provider returned invalid file data.",
      502,
    );
  }

  return value.map((item): ExternalFile => {
    if (!item || typeof item !== "object") {
      throw new AppError(
        "ARCADE_INVALID_RESPONSE",
        "The integration provider returned invalid file data.",
        502,
      );
    }
    const record = item as Record<string, unknown>;
    const sizeBytes = record.sizeBytes;
    if (
      typeof record.providerSourceId !== "string"
      || !record.providerSourceId
      || typeof record.name !== "string"
      || !record.name
      || typeof record.mimeType !== "string"
      || !record.mimeType
      || !(
        sizeBytes === null
        || (typeof sizeBytes === "number" && Number.isSafeInteger(sizeBytes) && sizeBytes >= 0)
      )
    ) {
      throw new AppError(
        "ARCADE_INVALID_RESPONSE",
        "The integration provider returned invalid file data.",
        502,
      );
    }

    const normalized: ArcadeExternalFileSeed = {
      providerSourceId: record.providerSourceId,
      name: record.name,
      mimeType: record.mimeType,
      sizeBytes,
      sourceVersion: readOptionalString(record, "sourceVersion"),
      sourceTimestamp: readOptionalString(record, "sourceTimestamp"),
    };

    return {
      provider: providerId,
      providerSourceId: normalized.providerSourceId,
      sourceVersion: normalized.sourceVersion ?? null,
      sourceTimestamp: normalized.sourceTimestamp ?? null,
      synchronizationRunId: null,
      // Arcade output is a candidate source only. Nothing from a provider is
      // professionally confirmed, persisted as ProjectFile, or written to a
      // BOQ by this adapter.
      reviewStatus: "PENDING",
      name: normalized.name,
      mimeType: normalized.mimeType,
      sizeBytes: normalized.sizeBytes,
    };
  });
}

/**
 * Actor-scoped bridge to the existing IntegrationConnector contract. Arcade
 * handles provider authorization, while Quantara keeps tenant resolution,
 * capability mapping, normalization, import selection, and review control.
 */
export class ArcadeBackedConnector implements IntegrationConnector {
  readonly providerId: string;
  readonly providerFamily: string;
  readonly displayName: string;
  readonly category: IntegrationConnector["category"];
  readonly connectionType: IntegrationConnector["connectionType"];
  readonly capabilities: string[];

  private readonly actor: CurrentActor;
  private readonly arcadeRuntime: ArcadeRuntime;
  private readonly connectionResolver: ArcadeConnectionResolver;
  private readonly providerStatus: Awaited<ReturnType<IntegrationConnector["getStatus"]>>;

  constructor(options: {
    actor: CurrentActor;
    providerId: string;
    runtime?: ArcadeRuntime;
    connectionResolver?: ArcadeConnectionResolver;
  }) {
    const provider = getProviderById(options.providerId);
    if (!provider) throw new NotFoundError("Integration provider not found.");

    this.arcadeRuntime = options.runtime ?? getArcadeRuntime();
    const configuration = this.arcadeRuntime.getProviderConfiguration(options.providerId);
    this.actor = options.actor;
    this.providerId = provider.id;
    this.providerFamily = provider.providerFamily;
    this.displayName = provider.displayName;
    this.category = provider.category;
    this.connectionType = provider.connectionType;
    this.providerStatus = provider.status;
    this.capabilities = Object.keys(configuration.capabilities);
    this.connectionResolver = options.connectionResolver ?? defaultConnectionResolver;
  }

  private assertActorCompany(companyId: string): void {
    if (companyId !== this.actor.companyId) {
      throw new NotFoundError("Integration connection not found.");
    }
  }

  private async assertConnection(externalConnectionId: string): Promise<void> {
    const connection = await this.connectionResolver(externalConnectionId);
    if (
      !connection
      || connection.companyId !== this.actor.companyId
      || connection.providerId !== this.providerId
    ) {
      // A 404 avoids disclosing whether another company owns the supplied ID.
      throw new NotFoundError("Integration connection not found.");
    }
  }

  async getStatus(companyId: string) {
    this.assertActorCompany(companyId);
    return this.arcadeRuntime.getConfigurationStatus().configured
      ? this.providerStatus
      : "ERROR" as const;
  }

  async initiateConnection(companyId: string, userId: string): Promise<{ redirectUrl: string; state: string }> {
    this.assertActorCompany(companyId);
    if (userId !== this.actor.userId) throw new NotFoundError("Integration connection not found.");
    return unsupported("generic connection initiation; use the provider-scoped authorization route");
  }

  async handleCallback(): Promise<{ externalConnectionId: string }> {
    return unsupported("a Quantara OAuth callback; Arcade owns its provider callback");
  }

  async refreshCredentials(externalConnectionId: string): Promise<void> {
    await this.assertConnection(externalConnectionId);
    return unsupported("credential refresh; Arcade owns provider credentials");
  }

  async listAccounts(externalConnectionId: string): Promise<ExternalProject[]> {
    await this.assertConnection(externalConnectionId);
    return unsupported("account listing");
  }

  async listProjects(externalConnectionId: string): Promise<ExternalProject[]> {
    await this.assertConnection(externalConnectionId);
    return unsupported("project listing");
  }

  async listFolders(
    externalConnectionId: string,
  ): Promise<{ id: string; name: string }[]> {
    await this.assertConnection(externalConnectionId);
    return unsupported("folder listing");
  }

  async listFiles(externalConnectionId: string, folderId: string): Promise<ExternalFile[]> {
    await this.assertConnection(externalConnectionId);
    const value = await this.arcadeRuntime.execute({
      actor: this.actor,
      providerId: this.providerId,
      capability: "LIST_FILES",
      input: { folderId },
    });
    return normalizeExternalFileSeeds(this.providerId, value);
  }

  async getFileVersion(externalConnectionId: string): Promise<ExternalVersion> {
    await this.assertConnection(externalConnectionId);
    return unsupported("file-version lookup");
  }

  async synchronizeSource(): Promise<{ inserted: number; updated: number; skipped: number }> {
    return unsupported("source synchronization");
  }

  async disconnect(externalConnectionId: string): Promise<void> {
    await this.assertConnection(externalConnectionId);
    return unsupported("disconnect; Arcade token revocation is not implemented in this foundation");
  }
}
