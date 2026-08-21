import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { createOpenAITranscriptionProvider } from "@/lib/voice/openai-transcription-provider";
import {
  type TranscriptionProvider,
  validateVoiceAudioFile,
} from "@/lib/voice/transcription-provider";
import type { VoiceTranscriptionResult } from "@/lib/voice/voice-types";

/**
 * Voice audio is deliberately held only in request memory for the provider
 * call. This service has no storage or persistence dependency.
 */
export async function transcribeProjectVoice(
  actor: CurrentActor,
  projectIdentifier: string,
  file: File,
  provider: TranscriptionProvider = createOpenAITranscriptionProvider(),
): Promise<VoiceTranscriptionResult> {
  requireCapability(actor, "boq:edit");
  await getProjectRecord(actor.companyId, projectIdentifier);
  const { mimeType } = validateVoiceAudioFile(file);
  const bytes = await file.arrayBuffer();
  return provider.transcribe({ bytes, fileName: file.name, mimeType });
}
