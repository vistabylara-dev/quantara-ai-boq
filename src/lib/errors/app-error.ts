export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    status = 400,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested record was not found.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "The record does not belong to the active company.") {
    super("FORBIDDEN_COMPANY_ACCESS", message, 403);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to perform this action.") {
    super("UNAUTHENTICATED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class PermissionDeniedError extends AppError {
  constructor(message = "Your role does not have permission to perform this action.") {
    super("PERMISSION_DENIED", message, 403);
    this.name = "PermissionDeniedError";
  }
}

export class LockedBOQError extends AppError {
  constructor(message = "This BOQ revision is locked and cannot be edited.") {
    super("BOQ_LOCKED", message, 409);
    this.name = "LockedBOQError";
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
    this.name = "ConflictError";
  }
}
