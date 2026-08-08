import { AppError } from "@/lib/errors/app-error";
import type { TranscriptionProvider, VoiceAudioInput } from "@/lib/voice/transcription-provider";
import type { VoiceTranscriptionResult } from "@/lib/voice/voice-types";

const OPENAI_TRANSCRIPTIONS_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

type OpenAITranscriptionProviderOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAITranscriptionProviderOptions = {}) {
    this.apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    this.model = (options.model ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_TRANSCRIPTION_MODEL).trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(input: VoiceAudioInput): Promise<VoiceTranscriptionResult> {
    if (!this.apiKey) {
      throw new AppError(
        "VOICE_TRANSCRIPTION_NOT_CONFIGURED",
        "Voice transcription is not configured for this environment.",
        503,
      );
    }

    const body = new FormData();
    body.append("file", new Blob([input.bytes], { type: input.mimeType }), input.fileName);
    body.append("model", this.model);

    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_TRANSCRIPTIONS_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body,
      });
    } catch (error) {
      console.error("[voice] OpenAI transcription request failed", error instanceof Error ? error.message : error);
      throw new AppError(
        "VOICE_TRANSCRIPTION_FAILED",
        "The voice recording could not be transcribed. Please try again.",
        502,
      );
    }

    if (!response.ok) {
      console.error("[voice] OpenAI transcription returned a non-success status", {
        status: response.status,
        requestId: response.headers.get("x-request-id"),
      });
      throw new AppError(
        "VOICE_TRANSCRIPTION_FAILED",
        "The voice recording could not be transcribed. Please try again.",
        502,
      );
    }

    const payload = await response.json().catch(() => null) as { text?: unknown } | null;
    const transcript = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!transcript) {
      throw new AppError(
        "VOICE_TRANSCRIPTION_EMPTY",
        "No speech could be transcribed from this recording.",
        422,
      );
    }

    return { transcript, provider: "openai", model: this.model };
  }
}

export function createOpenAITranscriptionProvider(): TranscriptionProvider {
  return new OpenAITranscriptionProvider();
}
