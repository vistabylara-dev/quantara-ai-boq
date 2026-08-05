import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { appBaseUrl } from "@/lib/auth/dev-mailer";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { buildPasswordResetEmail, buildVerificationEmail } from "@/lib/email/auth-email-templates";
import { getEmailProvider } from "@/lib/email/get-email-provider";
import { createCompany } from "@/lib/repositories/company-repository";
import { findUserByEmail, findUserById } from "@/lib/repositories/user-repository";
import type { registerSchema, loginSchema } from "@/lib/validation/auth-schemas";
import type { z } from "zod";

/**
 * Never throws — a delivery failure must never block registration or leak
 * through the generic forgot-password response. Never logs `input` (which
 * carries the raw token inside the URL), only the safe provider result.
 */
async function sendAuthEmail(input: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const result = await getEmailProvider().sendEmail(input);
  if (result.status === "FAILED") {
    console.error("[auth-email] delivery failed", {
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  }
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export async function registerCompanyOwner(input: RegisterInput) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError("EMAIL_ALREADY_REGISTERED", "An account with this email already exists.", 409, {
      email: ["This email is already registered."],
    });
  }

  const passwordHash = await hashPassword(input.password);

  const { user } = await prisma.$transaction(async (tx) => {
    const company = await createCompany(
      {
        legalName: input.companyName,
        tradeName: input.companyName,
        email: input.email.toLowerCase(),
        primaryIndustry: input.primaryIndustry,
        monthlyVolume: input.approximateVolume,
      },
      tx,
    );
    const createdUser = await tx.user.create({
      data: {
        companyId: company.id,
        email: input.email.toLowerCase(),
        passwordHash,
        fullName: input.fullName,
        role: UserRole.COMPANY_OWNER,
        jobTitle: input.role, // role maps to jobTitle in our UI
        marketingConsent: input.consent,
      },
    });

    // Give a newly registered company immediate access to every industry
    // engine so it can create projects right away; they can disable ones
    // they don't need from the industries settings page.
    const industries = await tx.industryEngine.findMany({ select: { id: true } });
    if (industries.length > 0) {
      await tx.companyIndustryEngine.createMany({
        data: industries.map((industry) => ({
          companyId: company.id,
          industryEngineId: industry.id,
          enabled: true,
        })),
      });
    }

    return { company, user: createdUser };
  });

  await issueEmailVerificationToken(user.id, user.email);

  return { userId: user.id, companyId: user.companyId, email: user.email };
}

export async function issueEmailVerificationToken(userId: string, email: string): Promise<void> {
  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });
  const url = `${appBaseUrl()}/verify-email?token=${rawToken}`;
  const { subject, html, text } = buildVerificationEmail(url);
  await sendAuthEmail({ to: email, subject, html, text });
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AppError("INVALID_OR_EXPIRED_TOKEN", "This verification link is invalid or has expired.", 400);
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
}

export async function loginWithPassword(input: LoginInput): Promise<void> {
  const user = await findUserByEmail(input.email);
  const genericError = () =>
    new AppError("INVALID_CREDENTIALS", "The email or password is incorrect.", 401);

  if (!user) {
    // Still hash to keep response timing similar whether or not the account exists.
    await hashPassword(input.password);
    throw genericError();
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw genericError();
  }

  if (!user.isActive) {
    throw new AppError("ACCOUNT_INACTIVE", "This account has been deactivated.", 403);
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      "Please verify your email address before signing in.",
      403,
    );
  }

  await createSession(user.id);
}

/**
 * Platform-admin login. Reuses the exact same credential/session mechanics
 * as loginWithPassword (no separate password store, no separate session
 * type), then additionally requires a platform role. A company-only account
 * with correct credentials still gets its session destroyed immediately and
 * sees the same generic invalid-credentials error as a wrong password would
 * — this route must never reveal that an email belongs to a valid company
 * account without platform access.
 */
export async function loginPlatformActor(input: LoginInput): Promise<void> {
  await loginWithPassword(input);

  const user = await findUserByEmail(input.email);
  if (!user?.platformRole) {
    await destroyCurrentSession();
    throw new AppError("INVALID_CREDENTIALS", "The email or password is incorrect.", 401);
  }
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) {
    // Do not reveal whether the account exists.
    return;
  }

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });
  const url = `${appBaseUrl()}/reset-password?token=${rawToken}`;
  const { subject, html, text } = buildPasswordResetEmail(url);
  await sendAuthEmail({ to: user.email, subject, html, text });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AppError("INVALID_OR_EXPIRED_TOKEN", "This reset link is invalid or has expired.", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Invalidate every existing session so a compromised session can't survive a reset.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}

export async function getUserById(userId: string) {
  return findUserById(userId);
}
