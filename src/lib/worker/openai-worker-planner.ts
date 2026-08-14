import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { WorkerAssignmentRecord } from "@/lib/services/worker-review-service";

export const WORKER_AI_PLANNER_VERSION = "worker-v1-bounded-advisory/1";
const MAX_CONTEXT_BYTES = 64 * 1024;
const MAX_ITEMS = 100;
const MAX_DECISIONS = 50;
const MAX_QUESTIONS = 50;

const actionKindSchema = z.enum([
  "REVIEW_MATERIAL_QUESTION",
  "OPEN_VERIFICATION_WORKSPACE",
  "OPEN_BOQ_INTEGRITY",
  "INVESTIGATE_EVIDENCE",
]);

export const workerAIPlanSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  actions: z.array(z.object({
    kind: actionKindSchema,
    subjectType: z.string().trim().min(1).max(80),
    subjectId: z.string().uuid(),
    rationale: z.string().trim().min(1).max(1_000),
  }).strict()).max(10),
  cautions: z.array(z.string().trim().min(1).max(500)).max(10),
  requiresHumanReview: z.literal(true),
}).strict();

export type WorkerAIPlan = z.infer<typeof workerAIPlanSchema>;

export type WorkerPlannerContext = {
  plannerVersion: string;
  assignment: {
    id: string;
    boqId: string;
    conclusion: string;
  };
  items: Array<{
    id: string;
    sectionCode: string;
    itemCode: string;
    description: string;
    quantityIntegrityState: string;
    rateIntegrityState: string;
  }>;
  decisions: Array<{
    id: string;
    code: string;
    outcome: string;
    severity: string;
    subjectType: string;
    subjectId: string | null;
    summary: string;
  }>;
  materialQuestions: Array<{
    id: string;
    questionType: string;
    subjectType: string;
    subjectId: string | null;
    prompt: string;
    whyMaterial: string;
    recommendedAction: string;
  }>;
};

export type BoundedPlannerInput = {
  context: WorkerPlannerContext;
  contextJson: string;
  contextSha256: string;
  allowedSubjectIds: ReadonlySet<string>;
};

export type BoundedPlannerResult = {
  provider: "openai";
  model: string;
  providerResponseId: string | null;
  plan: WorkerAIPlan;
  usage: Prisma.InputJsonValue | null;
};

export type WorkerPlanner = (input: BoundedPlannerInput) => Promise<BoundedPlannerResult>;

function truncate(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedState(value: unknown): string {
  return truncate(record(value)?.state, 40) || "UNKNOWN";
}

/**
 * Builds a deliberately narrow advisory context. Quantity, unit-cost, freight,
 * installation, margin and other commercial numeric values are never copied
 * into this object, even though they exist in the immutable V0 workspace.
 */
export function buildBoundedPlannerInput(assignment: WorkerAssignmentRecord): BoundedPlannerInput {
  if (!assignment.workspace) throw new Error("Worker assignment has no deterministic review workspace.");

  const workspaceItems = Array.isArray(assignment.workspace.itemsJson)
    ? assignment.workspace.itemsJson
    : [];
  const items = workspaceItems.slice(0, MAX_ITEMS).flatMap((value) => {
    const item = record(value);
    const id = truncate(item?.boqItemId, 64);
    if (!id) return [];
    return [{
      id,
      sectionCode: truncate(item?.sectionCode, 80),
      itemCode: truncate(item?.itemCode, 100),
      description: truncate(item?.description, 500),
      quantityIntegrityState: nestedState(item?.quantityIntegrity),
      rateIntegrityState: nestedState(item?.rateIntegrity),
    }];
  });

  const context: WorkerPlannerContext = {
    plannerVersion: WORKER_AI_PLANNER_VERSION,
    assignment: {
      id: assignment.id,
      boqId: assignment.boqId,
      conclusion: assignment.workspace.conclusion,
    },
    items,
    decisions: assignment.decisions.slice(0, MAX_DECISIONS).map((decision) => ({
      id: decision.id,
      code: decision.code,
      outcome: decision.outcome,
      severity: decision.severity,
      subjectType: truncate(decision.subjectType, 80),
      subjectId: decision.subjectId,
      summary: truncate(decision.summary, 500),
    })),
    materialQuestions: assignment.materialQuestions.slice(0, MAX_QUESTIONS).map((question) => ({
      id: question.id,
      questionType: question.questionType,
      subjectType: truncate(question.subjectType, 80),
      subjectId: question.subjectId,
      prompt: truncate(question.prompt, 500),
      whyMaterial: truncate(question.whyMaterial, 500),
      recommendedAction: truncate(question.recommendedAction, 500),
    })),
  };

  const contextJson = JSON.stringify(context);
  if (Buffer.byteLength(contextJson, "utf8") > MAX_CONTEXT_BYTES) {
    throw new Error("Bounded worker planner context exceeds its fixed size limit.");
  }

  const allowedSubjectIds = new Set<string>([
    assignment.id,
    assignment.boqId,
    ...items.map((item) => item.id),
    ...context.decisions.flatMap((decision) => [decision.id, decision.subjectId].filter((id): id is string => Boolean(id))),
    ...context.materialQuestions.flatMap((question) => [question.id, question.subjectId].filter((id): id is string => Boolean(id))),
  ]);

  return {
    context,
    contextJson,
    contextSha256: createHash("sha256").update(contextJson, "utf8").digest("hex"),
    allowedSubjectIds,
  };
}

const workerAIPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "priority", "actions", "cautions", "requiresHumanReview"],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 1_000 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    actions: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "subjectType", "subjectId", "rationale"],
        properties: {
          kind: { type: "string", enum: actionKindSchema.options },
          subjectType: { type: "string", minLength: 1, maxLength: 80 },
          subjectId: { type: "string", minLength: 36, maxLength: 36 },
          rationale: { type: "string", minLength: 1, maxLength: 1_000 },
        },
      },
    },
    cautions: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
    requiresHumanReview: { type: "boolean", const: true },
  },
} as const;

function extractOutputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  if (!Array.isArray(response.output)) throw new Error("OpenAI response did not contain structured output.");
  for (const output of response.output) {
    const outputRecord = record(output);
    if (!Array.isArray(outputRecord?.content)) continue;
    for (const content of outputRecord.content) {
      const contentRecord = record(content);
      if (contentRecord?.type === "refusal") throw new Error("OpenAI refused the bounded worker planning request.");
      if (contentRecord?.type === "output_text" && typeof contentRecord.text === "string") return contentRecord.text;
    }
  }
  throw new Error("OpenAI response did not contain structured output text.");
}

export function createOpenAIWorkerPlanner(
  config: { apiKey: string; model: string },
  fetchImpl: typeof fetch = fetch,
): WorkerPlanner {
  return async (input) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          input: [
            {
              role: "system",
              content: [{
                type: "input_text",
                text: "Create an advisory human-review plan from the supplied deterministic evidence summary. Never infer, calculate, approve, or change quantities, rates, dimensions, provenance, or governed records. Use only supplied subject IDs. requiresHumanReview must be true.",
              }],
            },
            { role: "user", content: [{ type: "input_text", text: input.contextJson }] },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "quantara_worker_advisory_plan",
              strict: true,
              schema: workerAIPlanJsonSchema,
            },
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw new Error(`OpenAI worker planner request failed with status ${response.status}.`);
    const raw = await response.json() as Record<string, unknown>;
    let decoded: unknown;
    try {
      decoded = JSON.parse(extractOutputText(raw));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("OpenAI worker planner returned invalid structured JSON.");
      throw error;
    }
    const plan = workerAIPlanSchema.parse(decoded);
    for (const action of plan.actions) {
      if (!input.allowedSubjectIds.has(action.subjectId)) {
        throw new Error("OpenAI worker planner referenced a subject outside the bounded context.");
      }
    }

    return {
      provider: "openai",
      model: config.model,
      providerResponseId: typeof raw.id === "string" ? raw.id : null,
      plan,
      usage: record(raw.usage) as Prisma.InputJsonObject | null,
    };
  };
}
