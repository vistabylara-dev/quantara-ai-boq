import { createDirectPrismaClient } from "../src/lib/db/direct-prisma-client";
import { fileURLToPath } from "node:url";
import { PlatformRole, Prisma, UserRole, type PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { passwordSchema } from "../src/lib/validation/auth-schemas";
import {
  bootstrapPlatformOwner,
  maskEmail,
  normalizePlatformOwnerEmail,
  PlatformOwnerBootstrapError,
} from "./bootstrap-platform-owner";

const PLATFORM_COMPANY_EMAIL = "platform@quantara.internal";
const PLATFORM_COMPANY_LEGAL_NAME = "Quantara Platform Administration";
const PROVISION_ACTION = "PLATFORM_OWNER_PROVISIONED";
const ACTIVATION_ACTION = "PLATFORM_OWNER_ACTIVATED_BY_PROVISIONING";

export class ProvisionPlatformOwnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisionPlatformOwnerError";
  }
}

export type ProvisionPlatformOwnerResult = {
  userId: string;
  email: string;
  created: boolean;
  roleChanged: boolean;
};

type ExistingUserRecord = {
  id: string;
  email: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  platformRole: PlatformRole | null;
};

async function provisionExistingOwner(
  database: PrismaClient,
  existing: ExistingUserRecord,
  activateExisting: boolean,
): Promise<ProvisionPlatformOwnerResult> {
  const needsActivation = !existing.isActive || !existing.emailVerifiedAt;

  if (needsActivation && !activateExisting) {
    throw new ProvisionPlatformOwnerError(
      "The account exists but is inactive or unverified. Re-run with --activate to explicitly activate and verify it before assigning the platform-owner role.",
    );
  }

  if (needsActivation) {
    await database.$transaction(async (tx) => {
      const before = {
        isActive: existing.isActive,
        emailVerified: existing.emailVerifiedAt !== null,
      };
      await tx.user.update({
        where: { id: existing.id },
        data: { isActive: true, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
      await tx.platformAuditLog.create({
        data: {
          actorUserId: existing.id,
          actorPlatformRole: existing.platformRole,
          action: ACTIVATION_ACTION,
          targetType: "User",
          targetId: existing.id,
          requestMetadataJson: { source: "local-cli-provisioning" },
          beforeJson: before,
          afterJson: { isActive: true, emailVerified: true },
        },
      });
    });
  }

  const result = await bootstrapPlatformOwner(database, existing.email);

  // Revoke stale sessions whenever this script has just handled an existing
  // account's platform access, so an old session token can't outlive a
  // deliberate administrative change to that account.
  await database.session.deleteMany({ where: { userId: existing.id } });

  return {
    userId: existing.id,
    email: existing.email,
    created: false,
    roleChanged: result.changed,
  };
}

async function provisionNewOwner(
  database: PrismaClient,
  email: string,
  providePassword: () => Promise<string>,
): Promise<ProvisionPlatformOwnerResult> {
  const rawPassword = await providePassword();
  const parsed = passwordSchema.safeParse(rawPassword);
  if (!parsed.success) {
    throw new ProvisionPlatformOwnerError(
      parsed.error.errors[0]?.message ?? "The password does not meet the required strength.",
    );
  }
  const passwordHash = await hashPassword(parsed.data);

  return database.$transaction(
    async (tx) => {
      const differentOwnerExists = await tx.user.count({
        where: { platformRole: PlatformRole.PLATFORM_OWNER },
      });
      if (differentOwnerExists > 0) {
        throw new ProvisionPlatformOwnerError(
          "A platform owner already exists. Refusing to create a second one.",
        );
      }

      let platformCompany = await tx.company.findFirst({
        where: { email: PLATFORM_COMPANY_EMAIL },
      });
      if (!platformCompany) {
        platformCompany = await tx.company.create({
          data: {
            legalName: PLATFORM_COMPANY_LEGAL_NAME,
            tradeName: PLATFORM_COMPANY_LEGAL_NAME,
            email: PLATFORM_COMPANY_EMAIL,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          companyId: platformCompany.id,
          email,
          passwordHash,
          fullName: "Platform Owner",
          role: UserRole.COMPANY_OWNER,
          platformRole: PlatformRole.PLATFORM_OWNER,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      });

      await tx.platformAuditLog.create({
        data: {
          actorUserId: user.id,
          actorPlatformRole: PlatformRole.PLATFORM_OWNER,
          action: PROVISION_ACTION,
          targetType: "User",
          targetId: user.id,
          requestMetadataJson: { source: "local-cli-provisioning" },
          beforeJson: { existed: false },
          afterJson: { platformRole: PlatformRole.PLATFORM_OWNER, companyId: platformCompany.id },
        },
      });

      return { userId: user.id, email: user.email, created: true, roleChanged: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Controlled owner bootstrap: creates the platform owner directly (backed by
 * one dedicated, non-customer company row used only to satisfy the required
 * User.companyId foreign key) when the account doesn't exist yet, or safely
 * promotes/repairs an existing account otherwise. Never creates a second
 * owner, never touches an existing user's password, and never runs
 * automatically — this module only acts when explicitly invoked.
 */
export async function provisionPlatformOwner(
  database: PrismaClient,
  configuredEmail: string | undefined,
  options: { activateExisting?: boolean; providePassword: () => Promise<string> },
): Promise<ProvisionPlatformOwnerResult> {
  const email = normalizePlatformOwnerEmail(configuredEmail);

  const existing = await database.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true, emailVerifiedAt: true, platformRole: true },
  });

  if (existing) {
    return provisionExistingOwner(database, existing, options.activateExisting ?? false);
  }
  return provisionNewOwner(database, email, options.providePassword);
}

function promptHidden(promptText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    process.stdout.write(promptText);
    stdin.resume();
    stdin.setEncoding("utf8");
    if (stdin.isTTY) stdin.setRawMode(true);

    let input = "";
    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    };
    const onData = (char: string) => {
      const code = char.charCodeAt(0);
      if (char === "\n" || char === "\r" || code === 4) {
        cleanup();
        process.stdout.write("\n");
        resolve(input);
        return;
      }
      if (code === 3) {
        cleanup();
        process.stdout.write("\n");
        reject(new ProvisionPlatformOwnerError("Cancelled."));
        return;
      }
      if (code === 127 || code === 8) {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };
    stdin.on("data", onData);
  });
}

async function runCli(): Promise<void> {
  const activateExisting = process.argv.includes("--activate");
  const database = createDirectPrismaClient();

  try {
    const result = await provisionPlatformOwner(database, process.env.PLATFORM_OWNER_EMAIL, {
      activateExisting,
      providePassword: async () => {
        const first = await promptHidden("Set a password for the new platform owner: ");
        const confirm = await promptHidden("Confirm password: ");
        if (first !== confirm) {
          throw new ProvisionPlatformOwnerError(
            "The password and confirmation did not match. No changes were applied.",
          );
        }
        return first;
      },
    });

    console.log(
      result.created
        ? "Platform owner provisioning: SUCCESS (account created)"
        : result.roleChanged
          ? "Platform owner provisioning: SUCCESS (role assigned)"
          : "Platform owner provisioning: SUCCESS (already configured)",
    );
    console.log(`User ID: ${result.userId.slice(0, 8)}...`);
    console.log(`Email: ${maskEmail(result.email)}`);
  } catch (error) {
    const reason =
      error instanceof ProvisionPlatformOwnerError || error instanceof PlatformOwnerBootstrapError
        ? error.message
        : "A database operation failed. No changes were applied.";
    console.error("Platform owner provisioning: FAILED");
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
