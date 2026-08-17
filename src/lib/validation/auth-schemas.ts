import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

export const registerSchema = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required.").max(255),
    fullName: z.string().trim().max(255).optional(),
    email: z.string().trim().email("A valid email address is required.").max(255),
    phone: z.string().trim().min(1, "Phone is required.").max(50),
    password: passwordSchema,
    role: z.string().optional(),
    country: z.string().optional(),
    primaryIndustry: z.string().optional(),
    intendedUse: z.string().optional(),
    approximateVolume: z.string().optional(),
    consent: z.boolean().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email("A valid email address is required.").max(255),
    password: z.string().min(1, "Password is required.").max(200),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().trim().min(1, "A verification token is required."),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().email("A valid email address is required.").max(255),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "A reset token is required."),
    password: passwordSchema,
  })
  .strict();
