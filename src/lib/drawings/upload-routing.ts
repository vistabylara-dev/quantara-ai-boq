import type { DrawingMetadataInput } from "@/lib/validation/drawing-schema";

/**
 * Drawing bytes must bypass application routes in production. The only
 * permitted production sequence is:
 *
 *   authorize with JSON -> transfer the File to private Blob -> finalize with JSON
 *
 * The buffered multipart route remains available only as a local-development
 * convenience when direct Blob storage is deliberately not configured.
 */

export const DIRECT_UPLOAD_CONFIG_ERROR_MARKER = "STORAGE_PROVIDER=vercel-blob";
const MULTIPART_BLOB_THRESHOLD_BYTES = 32 * 1024 * 1024;

export type DrawingUploadStage = "preparing" | "uploading" | "finalizing";

export type DrawingUploadDeclaration = {
  originalName: string;
  declaredMimeType: string;
  declaredByteSize: number;
};

export type DrawingUploadAuthorization = {
  sessionId: string;
  uploadToken: string;
  pathname: string;
  /** Server-selected canonical MIME bound into the scoped Blob token. */
  contentType: string;
  maxSizeBytes: number;
  expiresAt: string;
};

type DrawingUploadResumeState = {
  /** Exact browser File identity; a replacement File must never reuse this capability. */
  file: File;
  authorization: DrawingUploadAuthorization;
  transferState: "not_started" | "outcome_unknown" | "complete";
};

/**
 * Ephemeral upload checkpoint owned by the Drawing Intake component. It is
 * deliberately a plain in-memory ref value: callers must never put it in
 * localStorage/sessionStorage or serialize it because it contains the scoped
 * Blob client token.
 */
export type DrawingUploadResumeHandle = {
  current: DrawingUploadResumeState | null;
  revision: number;
};

export function createDrawingUploadResumeHandle(): DrawingUploadResumeHandle {
  return { current: null, revision: 0 };
}

/** Invalidates both a retained capability and any async attempt still using it. */
export function clearDrawingUploadResumeState(handle: DrawingUploadResumeHandle): void {
  handle.current = null;
  handle.revision += 1;
}

export class DrawingUploadCancelledError extends Error {
  constructor() {
    super("The staged drawing upload was cancelled.");
    this.name = "DrawingUploadCancelledError";
  }
}

export function isDrawingUploadCancelledError(error: unknown): error is DrawingUploadCancelledError {
  return error instanceof DrawingUploadCancelledError;
}

export type PrivateBlobTransfer = {
  pathname: string;
  file: File;
  access: "private";
  token: string;
  contentType: string;
  multipart: boolean;
  onProgress: (percentage: number) => void;
};

export type DrawingUploadDependencies = {
  authorize: (declaration: DrawingUploadDeclaration) => Promise<DrawingUploadAuthorization>;
  transferToPrivateBlob: (transfer: PrivateBlobTransfer) => Promise<void>;
  finalize: (input: { sessionId: string; metadata: DrawingMetadataInput }) => Promise<void>;
  bufferedUpload: (input: {
    file: File;
    metadata: DrawingMetadataInput;
    onProgress: (percentage: number) => void;
  }) => Promise<void>;
  getErrorMessage: (error: unknown) => string;
};

export type DrawingUploadInput = {
  file: File;
  metadata: DrawingMetadataInput;
  isProduction: boolean;
  onStage: (stage: DrawingUploadStage) => void;
  onProgress: (percentage: number) => void;
};

const TERMINAL_UPLOAD_SESSION_ERROR_CODES = new Set([
  "UPLOAD_SESSION_CANCELLED",
  "UPLOAD_SESSION_CONFLICT",
  "UPLOAD_SESSION_EXPIRED",
]);

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isTerminalUploadSessionError(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && TERMINAL_UPLOAD_SESSION_ERROR_CODES.has(code);
}

/**
 * The SDK explicitly confirms that this credential can no longer transfer.
 * Network, timeout, and unknown errors stay resumable because the PUT may
 * have reached Blob even when its browser response did not.
 */
function isSafelyClassifiedTransferFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "BlobClientTokenExpiredError";
}

/**
 * A missing local Blob provider is the only condition that may use the
 * buffered fallback. Production never falls back, including when storage is
 * misconfigured: that failure must remain visible instead of turning into a
 * request-body 413.
 */
export function shouldFallBackToBufferedUpload(errorMessage: string, isProduction: boolean): boolean {
  return !isProduction && errorMessage.includes(DIRECT_UPLOAD_CONFIG_ERROR_MARKER);
}

/**
 * Runs the browser upload workflow. Only `transferToPrivateBlob` receives the
 * File on the production path; authorize and finalize receive JSON metadata.
 */
export async function uploadDrawingWithSafeRouting(
  input: DrawingUploadInput,
  dependencies: DrawingUploadDependencies,
  resumeHandle: DrawingUploadResumeHandle = createDrawingUploadResumeHandle(),
): Promise<"direct" | "buffered"> {
  const contentType = input.file.type || "application/octet-stream";

  // A distinct File object is a deliberate replacement even when its name,
  // size, MIME, and modified timestamp happen to match the previous file.
  if (resumeHandle.current && resumeHandle.current.file !== input.file) {
    clearDrawingUploadResumeState(resumeHandle);
  }
  const attemptRevision = resumeHandle.revision;
  const assertAttemptActive = () => {
    if (resumeHandle.revision !== attemptRevision) {
      throw new DrawingUploadCancelledError();
    }
  };

  input.onStage("preparing");

  let resumeState = resumeHandle.current;
  if (!resumeState) {
    let authorization: DrawingUploadAuthorization;
    try {
      authorization = await dependencies.authorize({
        originalName: input.file.name,
        declaredMimeType: contentType,
        declaredByteSize: input.file.size,
      });
      assertAttemptActive();
    } catch (error) {
      if (!shouldFallBackToBufferedUpload(dependencies.getErrorMessage(error), input.isProduction)) {
        throw error;
      }

      input.onStage("uploading");
      await dependencies.bufferedUpload({
        file: input.file,
        metadata: input.metadata,
        onProgress: input.onProgress,
      });
      assertAttemptActive();
      clearDrawingUploadResumeState(resumeHandle);
      return "buffered";
    }

    resumeState = {
      file: input.file,
      authorization,
      transferState: "not_started",
    };
    resumeHandle.current = resumeState;
  }

  const authorization = resumeState.authorization;
  const finalizeRetainedUpload = async (): Promise<
    | { kind: "complete" }
    | { kind: "missing"; error: unknown }
  > => {
    input.onStage("finalizing");
    try {
      await dependencies.finalize({ sessionId: authorization.sessionId, metadata: input.metadata });
      assertAttemptActive();
      clearDrawingUploadResumeState(resumeHandle);
      return { kind: "complete" };
    } catch (error) {
      if (isTerminalUploadSessionError(error)) {
        clearDrawingUploadResumeState(resumeHandle);
      }
      if (errorCode(error) === "BLOB_OBJECT_MISSING") {
        return { kind: "missing", error };
      }
      throw error;
    }
  };

  // A lost PUT response is ambiguous: the object may already exist while
  // allowOverwrite=false prevents a blind repeat. Ask the idempotent finalize
  // endpoint first. Only an authoritative BLOB_OBJECT_MISSING response makes
  // a second PUT safe.
  if (resumeState.transferState === "outcome_unknown") {
    const recovered = await finalizeRetainedUpload();
    if (recovered.kind === "complete") return "direct";
    resumeState = { ...resumeState, transferState: "not_started" };
    resumeHandle.current = resumeState;
  }

  if (resumeState.transferState === "not_started") {
    input.onStage("uploading");
    resumeState = { ...resumeState, transferState: "outcome_unknown" };
    resumeHandle.current = resumeState;
    try {
      await dependencies.transferToPrivateBlob({
        pathname: authorization.pathname,
        file: input.file,
        access: "private",
        token: authorization.uploadToken,
        contentType: authorization.contentType,
        multipart: input.file.size > MULTIPART_BLOB_THRESHOLD_BYTES,
        onProgress: input.onProgress,
      });
      assertAttemptActive();
    } catch (error) {
      if (isSafelyClassifiedTransferFailure(error)) {
        clearDrawingUploadResumeState(resumeHandle);
      }
      throw error;
    }

    resumeState = { ...resumeState, transferState: "complete" };
    resumeHandle.current = resumeState;
  }

  const finalized = await finalizeRetainedUpload();
  if (finalized.kind === "missing") {
    // Blob has now authoritatively said the object is absent. Keep the same
    // authorization/path and let the next explicit Retry perform its PUT.
    resumeHandle.current = { ...resumeState, transferState: "not_started" };
    throw finalized.error;
  }
  return "direct";
}
