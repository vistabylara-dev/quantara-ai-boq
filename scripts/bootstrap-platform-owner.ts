import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
import { fileURLToPath } from "node:url";
import { PlatformRole, Prisma, type PrismaClient } from "@prisma/client";

const BOOTSTRAP_ACTION = "PLATFORM_OWNER_BOOTSTRAPPED";
const PROVISION_ACTION = "PLATFORM_OWNER_PROVISIONED";
const MAX_SERIALIZABLE_ATTEMPTS = 3;

export type PlatformOwnerBootstrapResult = {
  userId: string;
  email: string;
  changed: boolean;
};

export type PlatformOwnerBootstrapOptions = {
  auditSource?: "local-cli-bootstrap" | "trusted-runtime-recovery";
};

export class PlatformOwnerBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformOwnerBootstrapError";
  }
}

export function normalizePlatformOwnerEmail(value: string | undefined): string {
  const email = value?.trim().toLowerCase() ?? "";
  const atIndex = email.indexOf("@");

  if (!email) {
    throw new PlatformOwnerBootstrapError("PLATFORM_OWNER_EMAIL is required.");
  }

  if (atIndex <= 0 || atIndex === email.length - 1 || email.includes(" ")) {
    throw new PlatformOwnerBootstrapError("PLATFORM_OWNER_EMAIL is not a valid email address.");
  }

  return email;
}

function isSerializableConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Promotes one existing, active, verified account. This function deliberately
 * does not create users, passwords, verification records, or sessions.
 */
export async function bootstrapPlatformOwner(
  database: PrismaClient,
  configuredEmail: string | undefined = process.env.PLATFORM_OWNER_EMAIL,
  options: PlatformOwnerBootstrapOptions = {},
): Promise<PlatformOwnerBootstrapResult> {
  const email = normalizePlatformOwnerEmail(configuredEmail);

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          const user = await transaction.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              isActive: true,
              emailVerifiedAt: true,
              platformRole: true,
            },
          });

          if (!user) {
            throw new PlatformOwnerBootstrapError(
              "No existing user matches PLATFORM_OWNER_EMAIL. Register and verify the account first.",
            );
          }

          if (!user.isActive) {
            throw new PlatformOwnerBootstrapError("The selected user account is deactivated.");
          }

          if (!user.emailVerifiedAt) {
            throw new PlatformOwnerBootstrapError(
              "The selected user must verify their email before platform bootstrap.",
            );
          }

          const differentOwnerExists = await transaction.user.count({
            where: {
              id: { not: user.id },
              platformRole: PlatformRole.PLATFORM_OWNER,
            },
          });

          if (differentOwnerExists > 0) {
            throw new PlatformOwnerBootstrapError(
              "A different platform owner already exists. Use the authenticated owner workflow for role changes.",
            );
          }

          const ownerEstablishmentAuditCount = await transaction.platformAuditLog.count({
            where: {
              action: { in: [BOOTSTRAP_ACTION, PROVISION_ACTION] },
              targetType: "User",
              targetId: user.id,
            },
          });

          if (user.platformRole === PlatformRole.PLATFORM_OWNER) {
            if (ownerEstablishmentAuditCount !== 1) {
              throw new PlatformOwnerBootstrapError(
                "The configured owner has inconsistent role-establishment audit state. No changes were applied.",
              );
            }
            return {
              userId: user.id,
              email: user.email,
              changed: false,
            };
          }

          if (ownerEstablishmentAuditCount !== 0) {
            throw new PlatformOwnerBootstrapError(
              "The configured account has an owner-establishment audit without the matching owner role. No changes were applied.",
            );
          }

          await transaction.user.update({
            where: { id: user.id },
            data: { platformRole: PlatformRole.PLATFORM_OWNER },
            select: { id: true },
          });

          await transaction.platformAuditLog.create({
            data: {
              actorUserId: user.id,
              actorPlatformRole: PlatformRole.PLATFORM_OWNER,
              action: BOOTSTRAP_ACTION,
              targetType: "User",
              targetId: user.id,
              requestMetadataJson: {
                source: options.auditSource ?? "local-cli-bootstrap",
              },
              beforeJson: {
                platformRole: user.platformRole,
              },
              afterJson: {
                platformRole: PlatformRole.PLATFORM_OWNER,
              },
            },
          });

          return {
            userId: user.id,
            email: user.email,
            changed: true,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isSerializableConflict(error) && attempt < MAX_SERIALIZABLE_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }

  throw new PlatformOwnerBootstrapError(
    "The bootstrap could not obtain a serializable transaction. No changes were applied.",
  );
}

export function maskEmail(email: string): string {
  const [localPart, domain = ""] = email.split("@");
  const domainParts = domain.split(".");
  const domainName = domainParts.shift() ?? "";
  const suffix = domainParts.length > 0 ? `.${domainParts.join(".")}` : "";

  return `${localPart.slice(0, 1)}***@${domainName.slice(0, 1)}***${suffix}`;
}

function shortUserId(userId: string): string {
  return `${userId.slice(0, 8)}...`;
}

async function runCli(): Promise<void> {
  const database = createDirectPrismaClient();

  try {
    const result = await bootstrapPlatformOwner(database);
    console.log(
      result.changed
        ? "Platform owner bootstrap: SUCCESS"
        : "Platform owner bootstrap: SUCCESS (already configured)",
    );
    console.log(`User ID: ${shortUserId(result.userId)}`);
    console.log(`Email: ${maskEmail(result.email)}`);
  } catch (error) {
    const reason =
      error instanceof PlatformOwnerBootstrapError
        ? error.message
        : "A database operation failed. No changes were applied.";
    console.error("Platform owner bootstrap: FAILED");
    console.error(`Reason: ${reason}`);
    process.exitCode = 1;
  } finally {
    await database.$disconnect().catch(() => undefined);
  }
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  void runCli();
}
