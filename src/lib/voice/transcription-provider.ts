import { AppError } from "@/lib/errors/app-error";
import type { VoiceTranscriptionResult } from "@/lib/voice/voice-types";

export const MAX_VOICE_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_VOICE_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const MAX_VOICE_MULTIPART_BYTES = MAX_VOICE_AUDIO_BYTES + MAX_VOICE_MULTIPART_OVERHEAD_BYTES;

const SUPPORTED_MIME_TYPES_BY_EXTENSION = {
  webm: ["audio/webm"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
  ogg: ["audio/ogg", "application/ogg"],
} as const;

export type SupportedVoiceAudioExtension = keyof typeof SUPPORTED_MIME_TYPES_BY_EXTENSION;

export type VoiceAudioInput = {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

export interface TranscriptionProvider {
  transcribe(input: VoiceAudioInput): Promise<VoiceTranscriptionResult>;
}

export function assertVoiceMultipartContentLength(contentLength: string | null): void {
  if (contentLength === null) {
    throw new AppError(
      "CONTENT_LENGTH_REQUIRED",
      "A Content-Length header is required for voice recordings.",
      411,
    );
  }
  const normalized = contentLength.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new AppError("INVALID_CONTENT_LENGTH", "The request Content-Length is invalid.", 400);
  }
  const bytes = Number(normalized);
  if (!Number.isSafeInteger(bytes)) {
    throw new AppError("INVALID_CONTENT_LENGTH", "The request Content-Length is invalid.", 400);
  }
  if (bytes > MAX_VOICE_MULTIPART_BYTES) {
    throw new AppError(
      "VOICE_AUDIO_TOO_LARGE",
      `The voice recording exceeds the ${MAX_VOICE_AUDIO_BYTES / (1024 * 1024)}MB size limit.`,
      413,
    );
  }
}

function normalizedMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionFromName(fileName: string): string {
  const finalDot = fileName.lastIndexOf(".");
  return finalDot >= 0 ? fileName.slice(finalDot + 1).trim().toLowerCase() : "";
}

export function validateVoiceAudioFile(file: Pick<File, "name" | "size" | "type">): {
  extension: SupportedVoiceAudioExtension;
  mimeType: string;
} {
  if (file.size <= 0) {
    throw new AppError("VOICE_AUDIO_EMPTY", "The voice recording is empty.", 400);
  }
  if (file.size > MAX_VOICE_AUDIO_BYTES) {
    throw new AppError(
      "VOICE_AUDIO_TOO_LARGE",
      `The voice recording exceeds the ${MAX_VOICE_AUDIO_BYTES / (1024 * 1024)}MB size limit.`,
      413,
    );
  }

  const extension = extensionFromName(file.name);
  const mimeType = normalizedMimeType(file.type);
  if (!(extension in SUPPORTED_MIME_TYPES_BY_EXTENSION)) {
    throw new AppError(
      "VOICE_AUDIO_TYPE_UNSUPPORTED",
      "Supported voice formats are webm, wav, mp3, m4a, and ogg.",
      415,
    );
  }

  const supportedExtension = extension as SupportedVoiceAudioExtension;
  const allowedMimeTypes = SUPPORTED_MIME_TYPES_BY_EXTENSION[supportedExtension] as readonly string[];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new AppError(
      "VOICE_AUDIO_TYPE_UNSUPPORTED",
      `The uploaded .${supportedExtension} file has an unsupported audio content type.`,
      415,
    );
  }

  return { extension: supportedExtension, mimeType };
}
