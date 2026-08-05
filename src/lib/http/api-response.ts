import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError } from "@/lib/errors/app-error";

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccessBody<T>>({ ok: true, data }, { status });
}

export function apiFailure(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
) {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
  );
}

export async function parseJsonBody<Output, Input = Output>(
  request: Request,
  schema: ZodType<Output, ZodTypeDef, Input>,
): Promise<Output> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "The request body must contain valid JSON.", 400);
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The request contains invalid fields.",
      400,
      zodFieldErrors(result.error),
    );
  }
  return result.data;
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return apiFailure(error.code, error.message, error.status, error.fieldErrors);
  }

  if (error instanceof ZodError) {
    return apiFailure(
      "VALIDATION_ERROR",
      "The request contains invalid fields.",
      400,
      zodFieldErrors(error),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiFailure("UNIQUE_CONSTRAINT", "A record with the same unique value already exists.", 409);
    }
    if (error.code === "P2003") {
      return apiFailure("RELATION_CONSTRAINT", "The requested change conflicts with related records.", 409);
    }
    if (error.code === "P2025") {
      return apiFailure("NOT_FOUND", "The requested record was not found.", 404);
    }
    if (error.code === "P2034") {
      return apiFailure("CONCURRENT_WRITE_CONFLICT", "The record changed during this request. Please retry.", 409);
    }
    // Every other known Prisma error code (P2021 missing table, P2022 missing
    // column, P2010 raw query failure, etc.) must never reach the client —
    // error.message for these routinely embeds table/column/SQL text. Full
    // detail is logged server-side only; the client gets a generic, safe,
    // retryable failure. This `return` is unconditional specifically so no
    // PrismaClientKnownRequestError can ever fall through to the generic
    // domain-error branch below, which does surface `error.message` verbatim.
    console.error(`[database] Unhandled Prisma error ${error.code}`, error.message);
    return apiFailure(
      "DATABASE_UNAVAILABLE",
      "The database is temporarily unavailable. Please try again shortly.",
      503,
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return apiFailure("INVALID_DATABASE_REQUEST", "The request could not be applied to the data model.", 400);
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error("[database] Prisma is unavailable", error.message);
    return apiFailure("DATABASE_UNAVAILABLE", "The database is currently unavailable.", 503);
  }

  if (error && typeof error === "object" && "code" in error) {
    const domainError = error as { code?: unknown; message?: unknown; status?: unknown; statusCode?: unknown; field?: unknown };
    if (typeof domainError.code === "string" && typeof domainError.message === "string") {
      // Covers two shapes: AppError-family errors (a `status` field — reached here only if an
      // `instanceof AppError` check upstream somehow missed, e.g. a cross-module-instance error),
      // and standalone domain errors like LockedBOQError/TenantAccessError that carry `statusCode`
      // instead. Prefer whichever is actually present; 400 is the last-resort default.
      const status =
        typeof domainError.status === "number"
          ? domainError.status
          : typeof domainError.statusCode === "number"
            ? domainError.statusCode
            : 400;
      const fieldErrors = typeof domainError.field === "string"
        ? { [domainError.field]: [domainError.message] }
        : undefined;
      return apiFailure(domainError.code, domainError.message, status, fieldErrors);
    }
  }

  console.error("[api] Unhandled request error", error);
  return apiFailure("INTERNAL_ERROR", "An unexpected server error occurred.", 500);
}
