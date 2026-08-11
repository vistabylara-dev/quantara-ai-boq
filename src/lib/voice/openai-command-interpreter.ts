import { z } from "zod";
import type {
  NaturalLanguageVoiceInterpreter,
  VoiceCommandIntent,
  VoiceInterpreterContext,
} from "@/lib/voice/voice-command-interpreter";

const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Structured-output fallback for when the deterministic regex parser in
 * voice-command-interpreter.ts doesn't recognize a phrasing it wasn't
 * explicitly written for. This is the ONLY place an LLM touches voice
 * commands, and it never mutates anything itself — it returns a candidate
 * intent that:
 *   1. Is re-validated against the exact same strict allowlist
 *      (validateOptionalIntent) that governs the deterministic path.
 *   2. Becomes a signed proposal requiring explicit user confirmation.
 *   3. Is applied only through the existing repository mutation services.
 * Any failure (missing key, bad JSON, schema mismatch, network error) means
 * "no opinion" — return null and let the caller fall through to the existing
 * VOICE_COMMAND_NOT_SUPPORTED response. This must never throw and never
 * invent a command outside the allowlist below.
 */

const rawIntentSchema = z.object({
  commandType: z.enum([
    "SET_DIMENSION",
    "SET_BOQ_QUANTITY",
    "SET_BOQ_DESCRIPTION",
    "SET_BOQ_UNIT",
    "SET_BOQ_NOTES",
    "ADD_BOQ_ITEM",
    "DELETE_BOQ_ITEM",
    "NONE",
  ]),
  field: z.enum(["value", "quantity", "description", "unit", "notes", "item"]).optional(),
  dimensionKey: z.string().trim().min(1).max(100).optional(),
  newValue: z.union([z.string(), z.number()]).optional(),
  unit: z.string().trim().max(20).optional(),
  itemDraft: z
    .object({
      description: z.string().trim().min(1).max(2000),
      quantity: z.number().finite().positive(),
      unit: z.string().trim().min(1).max(50),
      itemCode: z.string().trim().max(100).optional(),
      unitCost: z.number().finite().min(0).optional(),
    })
    .optional(),
}).strict();

function systemPromptFor(context: VoiceInterpreterContext): string {
  const base =
    "You convert a spoken instruction about a construction Bill of Quantities into ONE structured "
    + "command from a fixed allowlist. You never invent fields, never guess numeric values that were "
    + "not actually spoken, and never answer in prose — only the JSON object described. If the "
    + "instruction does not clearly and safely map to an allowed command, return "
    + '{"commandType":"NONE"}.';

  if (context.type === "DIMENSION_CALCULATION") {
    const options = context.dimensions.map((d) => `${d.key} (label: "${d.label}", unit: ${d.unit ?? "none"})`).join("; ");
    return `${base} Allowed command: SET_DIMENSION with one of these exact dimensionKey values: ${options}. `
      + 'Respond as {"commandType":"SET_DIMENSION","dimensionKey":"<key>","newValue":<number>}.';
  }
  if (context.type === "BOQ_SECTION") {
    return `${base} Allowed command: ADD_BOQ_ITEM only. Respond as `
      + '{"commandType":"ADD_BOQ_ITEM","itemDraft":{"description":"<text>","quantity":<number>,"unit":"<unit>"}} '
      + "with optional itemCode/unitCost inside itemDraft. Only include a unit that was actually spoken "
      + "(m, m2, m3, kg, nr, %, etc).";
  }
  return `${base} Allowed commands for a single BOQ item: SET_BOQ_QUANTITY (field "quantity", numeric newValue), `
    + 'SET_BOQ_DESCRIPTION (field "description", text newValue), SET_BOQ_UNIT (field "unit", text newValue), '
    + 'SET_BOQ_NOTES (field "notes", text newValue), or DELETE_BOQ_ITEM. Respond as '
    + '{"commandType":"...","field":"...","newValue":"..."} (omit field/newValue for DELETE_BOQ_ITEM).';
}

type OpenAIVoiceCommandInterpreterOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export class OpenAIVoiceCommandInterpreter implements NaturalLanguageVoiceInterpreter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIVoiceCommandInterpreterOptions = {}) {
    this.apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    this.model = (options.model ?? process.env.OPENAI_VOICE_INTERPRETER_MODEL ?? DEFAULT_MODEL).trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async interpret(transcript: string, context: VoiceInterpreterContext): Promise<VoiceCommandIntent | null> {
    if (!this.apiKey) return null;

    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPromptFor(context) },
            { role: "user", content: transcript },
          ],
        }),
        // Bounded so a hung OpenAI request can never hang the whole voice
        // interaction (or a serverless function) indefinitely — a timeout is
        // just another "no opinion" case, same as any other fetch failure.
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      console.error(
        isTimeout ? "[voice] OpenAI command interpretation timed out" : "[voice] OpenAI command interpretation request failed",
        isTimeout ? undefined : error instanceof Error ? error.message : error,
      );
      return null;
    }

    if (!response.ok) {
      console.error("[voice] OpenAI command interpretation returned a non-success status", { status: response.status });
      return null;
    }

    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      return null;
    }

    const parsed = rawIntentSchema.safeParse(parsedJson);
    if (!parsed.success || parsed.data.commandType === "NONE") return null;

    const { commandType, field, dimensionKey, newValue, unit, itemDraft } = parsed.data;

    if (commandType === "SET_DIMENSION") {
      if (!dimensionKey || typeof newValue !== "number") return null;
      return { commandType, field: "value", dimensionKey, newValue, ...(unit ? { unit } : {}), warnings: [], confidence: 60 };
    }
    if (commandType === "ADD_BOQ_ITEM") {
      if (!itemDraft) return null;
      return { commandType, field: "item", newValue: itemDraft.description, itemDraft, warnings: [], confidence: 60 };
    }
    if (commandType === "DELETE_BOQ_ITEM") {
      return { commandType, field: "item", newValue: "Deleted", warnings: [], confidence: 60 };
    }
    // SET_BOQ_QUANTITY / SET_BOQ_DESCRIPTION / SET_BOQ_UNIT / SET_BOQ_NOTES
    if (!field || newValue === undefined) return null;
    return { commandType, field, newValue, ...(unit ? { unit } : {}), warnings: [], confidence: 60 };
  }
}

export function createOpenAIVoiceCommandInterpreter(): NaturalLanguageVoiceInterpreter | undefined {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return undefined;
  return new OpenAIVoiceCommandInterpreter();
}
