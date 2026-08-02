import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { appBaseUrl, logDevEmailLink } from "@/lib/auth/dev-mailer";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { generateRawToken, hashToken } from "@/lib/auth/tokens";
import { createCompany } from "@/lib/repositories/company-repository";
import { findUserByEmail, findUserById } from "@/lib/repositories/user-repository";
import type { registerSchema, loginSchema } from "@/lib/validation/auth-schemas";
import type { z } from "zod";

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
    const company = await createCompany({
      legalName: input.companyName,
      tradeName: input.companyName,
      email: input.email.toLowerCase(),
    });
    const createdUser = await tx.user.create({
      data: {
        companyId: company.id,
        email: input.email.toLowerCase(),
        passwordHash,
        fullName: input.fullName,
        role: UserRole.COMPANY_OWNER,
      },
    });
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
  logDevEmailLink("Email verification", email, url);
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
  logDevEmailLink("Password reset", user.email, url);
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
