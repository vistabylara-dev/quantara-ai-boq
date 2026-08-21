import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

export type CreateUserInput = {
  companyId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
};

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export function createUser(input: CreateUserInput) {
  return prisma.user.create({
    data: {
      companyId: input.companyId,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: input.role,
    },
  });
}

export function markEmailVerified(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
}

export function setPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function listCompanyUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCompanyUser(companyId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) {
    throw new NotFoundError("The requested user was not found.");
  }
  return user;
}

export function setUserRole(companyId: string, userId: string, role: UserRole) {
  return prisma.user.updateMany({ where: { id: userId, companyId }, data: { role } });
}

export function setUserActive(companyId: string, userId: string, isActive: boolean) {
  return prisma.user.updateMany({ where: { id: userId, companyId }, data: { isActive } });
}
