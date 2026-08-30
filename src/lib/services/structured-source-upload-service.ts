import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import {
  assertNoDrawingSignature,
  validateStructuredSourceUpload,
} from "@/lib/files/structured-source-upload";
import {
  uploadProjectFile,
  type UploadProjectFileInput,
} from "@/lib/services/project-file-service";

/**
 * The buffered /files route is intentionally narrower than the general
 * project-file service used by direct Blob, integrations, and local tooling.
 */
export async function uploadStructuredProjectSource(
  actor: CurrentActor,
  projectId: string,
  input: UploadProjectFileInput,
) {
  requireCapability(actor, "files:manage");
  validateStructuredSourceUpload(input.originalName, input.mimeType, input.buffer.byteLength);
  assertNoDrawingSignature(input.buffer);
  return uploadProjectFile(actor, projectId, input);
}
