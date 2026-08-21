import {
  IndustryPackageStatus,
  PlatformRole,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);
const searchSchema = z.string().trim().max(200).optional();
const queryBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const platformCompanyListQuerySchema = z
  .object({
    search: searchSchema,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const platformUserListQuerySchema = z
  .object({
    search: searchSchema,
    companyId: z.string().uuid("A valid company ID is required.").optional(),
    isActive: queryBooleanSchema.optional(),
    platformRole: z.nativeEnum(PlatformRole).optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const platformSubscriptionListQuerySchema = z
  .object({
    search: searchSchema,
    companyId: z.string().uuid("A valid company ID is required.").optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const platformDataPackageListQuerySchema = z
  .object({
    search: searchSchema,
    status: z.nativeEnum(IndustryPackageStatus).optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const platformAuditListQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(120).optional(),
    targetType: z.string().trim().min(1).max(120).optional(),
    actorUserId: z.string().uuid("A valid actor user ID is required.").optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const platformAdminUserIdParamsSchema = z
  .object({
    userId: z.string().uuid("A valid user ID is required."),
  })
  .strict();

export const platformUserStatusUpdateSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const platformUserRoleUpdateSchema = z
  .object({
    platformRole: z.nativeEnum(PlatformRole).nullable(),
  })
  .strict();

export type PlatformCompanyListQuery = z.output<typeof platformCompanyListQuerySchema>;
export type PlatformUserListQuery = z.output<typeof platformUserListQuerySchema>;
export type PlatformSubscriptionListQuery = z.output<typeof platformSubscriptionListQuerySchema>;
export type PlatformDataPackageListQuery = z.output<typeof platformDataPackageListQuerySchema>;
export type PlatformAuditListQuery = z.output<typeof platformAuditListQuerySchema>;
export type PlatformUserStatusUpdateInput = z.output<typeof platformUserStatusUpdateSchema>;
export type PlatformUserRoleUpdateInput = z.output<typeof platformUserRoleUpdateSchema>;
