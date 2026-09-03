import { ExtractedEntityType } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import {
  listSupportedCalculationTypes,
} from "@/lib/calculations/required-dimensions-registry";
import {
  TAYQAN_MEASUREMENT_EXCEPTION_KINDS,
  TAYQAN_MEASUREMENT_METHODS,
  tayqanMeasurementPlanSchema,
  type TayqanMeasurementPlan,
} from "@/lib/tayqan/tayqan-measurement-contract";
import {
  applyTayqanSeniorReview,
  buildTayqanMeasurementClusters,
  calculateTayqanEvidencePageCoveragePercent,
  mergeTayqanMeasurementPlans,
  tayqanMeasurementProposalKey,
  tayqanSeniorReviewSchema,
  type TayqanMeasurementEvidenceBundle,
  type TayqanMeasurementReasoner,
  type TayqanMeasurementReasonerResult,
  type TayqanSeniorReview,
} from "@/lib/tayqan/tayqan-measurement-reasoner";

const MAX_PAGE_TEXT = 12_000;
const MAX_ENTITY_TEXT = 2_500;
const MAX_CLUSTER_CONCURRENCY = 2;
const MAX_PAGES_PER_CLUSTER = 8;
const REQUEST_RETRY_COUNT = 2;
const GLOBAL_REVIEW_BATCH_SIZE = 200;
/** PR2 gap 1: table/schedule entities have no page to cluster by, so they're attached project-wide instead — capped so one huge schedule file can't blow out every cluster's prompt. */
const MAX_TABLE_SCHEDULE_ENTITIES = 200;
/** PR2 gap 2: bounds the existing-BOQ reconciliation context the same way entity/room evidence is already bounded. */
const MAX_EXISTING_BOQ_ITEMS = 400;

type OpenAITayqanMeasurementConfig = {
  apiKey: string;
  model: string;
  safetyIdentifier?: string;
  useSeniorProMode?: boolean;
};

export type OpenAIProviderDiagnostic = {
  classification: string;
  providerCode: string | null;
  providerType: string | null;
  httpStatus: number;
  requestId: string | null;
  organizationId: string | null;
  projectId: string | null;
  retryAfter: string | null;
  requestLimit: string | null;
  remainingRequests: string | null;
  requestReset: string | null;
  tokenLimit: string | null;
  remainingTokens: string | null;
  tokenReset: string | null;
};

class NonRetryableOpenAIError extends AppError {
  readonly providerDiagnostic: OpenAIProviderDiagnostic;

  constructor(diagnostic: OpenAIProviderDiagnostic) {
    const providerReference = diagnostic.requestId
      ? ` Provider request: ${diagnostic.requestId}.`
      : "";
    super(
      "TAYQAN_MEASUREMENT_AI_REQUEST_REJECTED",
      `TAYQAN's AI measurement request was rejected by the configured provider (HTTP ${diagnostic.httpStatus}; ${diagnostic.classification}).${providerReference} Retry this same assignment only after the classified provider constraint is resolved.`,
      503,
    );
    this.providerDiagnostic = diagnostic;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractOutputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  if (!Array.isArray(response.output)) {
    throw new AppError(
      "TAYQAN_MEASUREMENT_AI_RESPONSE_INVALID",
      "TAYQAN's AI provider returned no structured measurement output. Retry this same assignment; completed work remains preserved.",
      503,
    );
  }
  for (const output of response.output) {
    const outputRecord = record(output);
    if (!Array.isArray(outputRecord?.content)) continue;
    for (const content of outputRecord.content) {
      const contentRecord = record(content);
      if (contentRecord?.type === "refusal") {
        throw new AppError(
          "TAYQAN_MEASUREMENT_AI_REFUSED",
          "TAYQAN's AI provider refused the bounded measurement request. Retry the same assignment or review the source content if the refusal continues.",
          503,
        );
      }
      if (contentRecord?.type === "output_text" && typeof contentRecord.text === "string") {
        return contentRecord.text;
      }
    }
  }
  throw new AppError(
    "TAYQAN_MEASUREMENT_AI_RESPONSE_INVALID",
    "TAYQAN's AI provider returned a response without structured measurement text. Retry this same assignment; completed work remains preserved.",
    503,
  );
}

const measurementPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subjects", "exceptions"],
  properties: {
    subjects: {
      type: "array",
      maxItems: 350,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "existingEntityId",
          "primaryPageId",
          "evidencePageIds",
          "entityType",
          "label",
          "workPackage",
          "location",
          "measurementMethod",
          "methodSelectionRationale",
          "methodConfidence",
          "calculationType",
          "inputs",
          "supportingChecks",
          "rationale",
          "sourceSummary",
          "confidence",
        ],
        properties: {
          existingEntityId: { type: ["string", "null"] },
          primaryPageId: { type: "string" },
          evidencePageIds: { type: "array", minItems: 1, maxItems: 16, items: { type: "string" } },
          entityType: { type: "string", enum: Object.values(ExtractedEntityType) },
          label: { type: "string", minLength: 1, maxLength: 240 },
          workPackage: { type: "string", minLength: 1, maxLength: 160 },
          location: { type: ["string", "null"], maxLength: 160 },
          measurementMethod: { type: "string", enum: [...TAYQAN_MEASUREMENT_METHODS] },
          methodSelectionRationale: { type: "string", minLength: 1, maxLength: 1_500 },
          methodConfidence: { type: "number", minimum: 0, maximum: 100 },
          calculationType: { type: "string", enum: listSupportedCalculationTypes() },
          inputs: {
            type: "array",
            minItems: 1,
            maxItems: 16,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "key",
                "value",
                "unit",
                "derivation",
                "evidencePageIds",
                "evidenceRoomIds",
                "evidenceNote",
                "confidence",
              ],
              properties: {
                key: { type: "string", minLength: 1, maxLength: 80 },
                value: { type: "number", minimum: 0 },
                unit: { type: ["string", "null"] },
                derivation: {
                  type: "string",
                  enum: [
                    "EXPLICIT_DIMENSION",
                    "SCHEDULE_VALUE",
                    "DIRECT_COUNT",
                    "COUNT_RECONCILIATION",
                    "ROOM_GEOMETRY",
                    "VERIFIED_SCALE_GEOMETRY",
                  ],
                },
                evidencePageIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
                evidenceRoomIds: { type: "array", maxItems: 8, items: { type: "string" } },
                evidenceNote: { type: "string", minLength: 1, maxLength: 500 },
                confidence: { type: "number", minimum: 0, maximum: 100 },
              },
            },
          },
          supportingChecks: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "application",
                "measurementMethod",
                "calculationType",
                "inputs",
                "rationale",
                "confidence",
              ],
              properties: {
                application: { type: "string", enum: ["CROSS_CHECK", "REPETITION_MULTIPLIER"] },
                measurementMethod: { type: "string", enum: [...TAYQAN_MEASUREMENT_METHODS] },
                calculationType: { type: "string", enum: listSupportedCalculationTypes() },
                inputs: {
                  type: "array",
                  minItems: 1,
                  maxItems: 16,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "key",
                      "value",
                      "unit",
                      "derivation",
                      "evidencePageIds",
                      "evidenceRoomIds",
                      "evidenceNote",
                      "confidence",
                    ],
                    properties: {
                      key: { type: "string", minLength: 1, maxLength: 80 },
                      value: { type: "number", minimum: 0 },
                      unit: { type: ["string", "null"] },
                      derivation: {
                        type: "string",
                        enum: [
                          "EXPLICIT_DIMENSION",
                          "SCHEDULE_VALUE",
                          "DIRECT_COUNT",
                          "COUNT_RECONCILIATION",
                          "ROOM_GEOMETRY",
                          "VERIFIED_SCALE_GEOMETRY",
                        ],
                      },
                      evidencePageIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
                      evidenceRoomIds: { type: "array", maxItems: 8, items: { type: "string" } },
                      evidenceNote: { type: "string", minLength: 1, maxLength: 500 },
                      confidence: { type: "number", minimum: 0, maximum: 100 },
                    },
                  },
                },
                rationale: { type: "string", minLength: 1, maxLength: 1_200 },
                confidence: { type: "number", minimum: 0, maximum: 100 },
              },
            },
          },
          rationale: { type: "string", minLength: 1, maxLength: 2_000 },
          sourceSummary: { type: "string", minLength: 1, maxLength: 2_000 },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
      },
    },
    exceptions: {
      type: "array",
      maxItems: 350,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "message", "pageIds", "relatedEntityId"],
        properties: {
          kind: {
            type: "string",
            enum: [...TAYQAN_MEASUREMENT_EXCEPTION_KINDS],
          },
          message: { type: "string", minLength: 1, maxLength: 1_500 },
          pageIds: { type: "array", maxItems: 16, items: { type: "string" } },
          relatedEntityId: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const seniorReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions", "findings"],
  properties: {
    decisions: {
      type: "array",
      maxItems: 350,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "proposalKey",
          "decision",
          "exceptionKind",
          "severity",
          "message",
          "pageIds",
        ],
        properties: {
          proposalKey: { type: "string", minLength: 1, maxLength: 900 },
          decision: { type: "string", enum: ["ACCEPT", "REJECT"] },
          exceptionKind: {
            type: ["string", "null"],
            enum: [...TAYQAN_MEASUREMENT_EXCEPTION_KINDS, null],
          },
          severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          message: { type: "string", minLength: 1, maxLength: 1_500 },
          pageIds: { type: "array", minItems: 1, maxItems: 16, items: { type: "string" } },
        },
      },
    },
    findings: {
      type: "array",
      maxItems: 350,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "severity", "message", "pageIds", "relatedProposalKeys"],
        properties: {
          kind: { type: "string", enum: [...TAYQAN_MEASUREMENT_EXCEPTION_KINDS] },
          severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          message: { type: "string", minLength: 1, maxLength: 1_500 },
          pageIds: { type: "array", minItems: 1, maxItems: 16, items: { type: "string" } },
          relatedProposalKeys: { type: "array", maxItems: 24, items: { type: "string" } },
        },
      },
    },
  },
} as const;

/**
 * PR2 gap 1: entities from schedule/CSV/XLSX files (extractionMethod
 * TABLE_PARSER, no drawingPageId — those files produce no rendered
 * DrawingPage) can't be matched to a cluster by page or file, since
 * clustering itself is page-based. Rather than guess a discipline mapping
 * that doesn't exist for these files, they're treated as relevant to every
 * cluster in the frozen source scope — capped, and always project-wide, not
 * silently dropped.
 */
function isTableScheduleEntity(
  entity: TayqanMeasurementEvidenceBundle["existingEntities"][number],
): boolean {
  return entity.extractionMethod === "TABLE_PARSER" && !entity.drawingPageId;
}

function toPromptEntity(entity: TayqanMeasurementEvidenceBundle["existingEntities"][number]) {
  return {
    ...entity,
    sourceText: entity.sourceText?.slice(0, MAX_ENTITY_TEXT) ?? null,
    technicalData: entity.technicalData,
    // Explicit so the model never mistakes schedule/table data for
    // something read off a drawing sheet — it must reason about each
    // differently (e.g. a WEIGHT/reinforcement measurement needs sufficient
    // schedule/bar evidence specifically, not just a page reference).
    evidenceSource: isTableScheduleEntity(entity) ? "TABLE_SCHEDULE" : "DRAWING_PAGE",
  };
}

function toPromptBoqItem(item: TayqanMeasurementEvidenceBundle["existingBoqItems"][number]) {
  return item;
}

function clusterContext(
  bundle: TayqanMeasurementEvidenceBundle,
  pageIds: readonly string[],
) {
  const pageSet = new Set(pageIds);
  const pages = bundle.pages
    .filter((page) => pageSet.has(page.id))
    .map((page) => ({
      id: page.id,
      projectFileId: page.projectFileId,
      file: page.originalName,
      pageNumber: page.pageNumber,
      drawingNumber: page.drawingNumber,
      drawingTitle: page.drawingTitle,
      revisionNumber: page.revisionNumber,
      discipline: page.discipline,
      drawingType: page.drawingType,
      sheetName: page.sheetName,
      role: page.role,
      text: page.text?.slice(0, MAX_PAGE_TEXT) ?? null,
      drawingTitles: page.drawingTitles,
      technicalLines: page.technicalLines,
      detectedScale: page.detectedScale,
      scaleVerified: page.scaleVerified,
      scaleRatio: page.scaleRatio,
      drawingUnit: page.drawingUnit,
      realWorldUnit: page.realWorldUnit,
      hasImage: page.hasImage,
      classification: page.classification,
    }));

  const fileIds = new Set(pages.map((page) => page.projectFileId));
  const pageMatchedEntities = bundle.existingEntities.filter((entity) =>
    (entity.drawingPageId && pageSet.has(entity.drawingPageId))
    || fileIds.has(entity.projectFileId),
  );
  const tableScheduleEntities = bundle.existingEntities
    .filter(isTableScheduleEntity)
    .slice(0, MAX_TABLE_SCHEDULE_ENTITIES);
  const entities = [...pageMatchedEntities, ...tableScheduleEntities]
    .filter((entity, index, all) => all.findIndex((candidate) => candidate.id === entity.id) === index)
    .slice(0, 160 + MAX_TABLE_SCHEDULE_ENTITIES)
    .map(toPromptEntity);

  const rooms = bundle.rooms
    .filter((room) => !room.drawingPageId || pageSet.has(room.drawingPageId))
    .slice(0, 120);

  return {
    project: bundle.project,
    governingContext: bundle.governingContext,
    pages,
    existingEntities: entities,
    rooms,
    // PR2 gap 2: reconciliation context — only ever non-empty for an
    // UPDATE_EXISTING_BOQ assignment (buildEvidenceBundle leaves it empty
    // otherwise), attached to every cluster for the same reason table
    // evidence is: any cluster's proposed scope could overlap existing rows.
    existingBoqItems: bundle.existingBoqItems.slice(0, MAX_EXISTING_BOQ_ITEMS).map(toPromptBoqItem),
  };
}

function compactProjectContext(bundle: TayqanMeasurementEvidenceBundle) {
  return {
    project: bundle.project,
    governingContext: bundle.governingContext,
    pages: bundle.pages.map((page) => ({
      id: page.id,
      projectFileId: page.projectFileId,
      file: page.originalName,
      pageNumber: page.pageNumber,
      drawingNumber: page.drawingNumber,
      drawingTitle: page.drawingTitle,
      revisionNumber: page.revisionNumber,
      discipline: page.discipline,
      role: page.role,
      detectedScale: page.detectedScale,
      scaleVerified: page.scaleVerified,
      technicalLines: page.technicalLines.slice(0, 20),
      text: page.text?.slice(0, 1_200) ?? null,
      classification: page.classification,
    })),
    // PR2 gap 1: the final cross-cluster reconciliation pass explicitly
    // checks for duplicate scope and schedule-plan mismatches (see
    // seniorCheckerInstruction's globalReview branch) — it cannot do that
    // job for schedule-sourced scope without seeing the schedule evidence.
    scheduleEvidence: bundle.existingEntities
      .filter(isTableScheduleEntity)
      .slice(0, MAX_TABLE_SCHEDULE_ENTITIES)
      .map(toPromptEntity),
    // PR2 gap 2: same reconciliation context as clusterContext, for the
    // global pass's own duplicate/consistency checking.
    existingBoqItems: bundle.existingBoqItems.slice(0, MAX_EXISTING_BOQ_ITEMS).map(toPromptBoqItem),
  };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
}

function supportsGpt56Features(model: string): boolean {
  return /^gpt-5\.6(?:-|$)/i.test(model.trim());
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function sanitizedProviderToken(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value)
    ? value
    : null;
}

export function providerResponseMetadata(response: Pick<Response, "headers">) {
  const header = (name: string) => sanitizedProviderToken(response.headers.get(name));
  return {
    requestId: header("x-request-id"),
    organizationId: header("openai-organization"),
    projectId: header("openai-project"),
    retryAfter: header("retry-after"),
    requestLimit: header("x-ratelimit-limit-requests"),
    remainingRequests: header("x-ratelimit-remaining-requests"),
    requestReset: header("x-ratelimit-reset-requests"),
    tokenLimit: header("x-ratelimit-limit-tokens"),
    remainingTokens: header("x-ratelimit-remaining-tokens"),
    tokenReset: header("x-ratelimit-reset-tokens"),
  };
}

export function classifyProviderFailure(status: number, providerCode: string | null): string {
  if (providerCode === "rate_limit_exceeded") return "rate_limit_exceeded";
  if (providerCode === "credit_balance_exhausted") return "credit_balance_exhausted";
  if (providerCode === "insufficient_quota") return "insufficient_quota";
  if (providerCode === "context_length_exceeded") return "context_length_exceeded";
  if (providerCode === "model_not_found") return "model_or_project_access";
  return status === 429 ? "unclassified_429" : "provider_request_rejected";
}

async function providerDiagnostic(response: Response): Promise<OpenAIProviderDiagnostic> {
  let body: Record<string, unknown> | null = null;
  try {
    body = record(await response.json());
  } catch {
    // Non-JSON failures still retain safe headers and HTTP status.
  }
  const providerError = record(body?.error);
  const providerCode = sanitizedProviderToken(providerError?.code);
  return {
    classification: classifyProviderFailure(response.status, providerCode),
    providerCode,
    providerType: sanitizedProviderToken(providerError?.type),
    httpStatus: response.status,
    ...providerResponseMetadata(response),
  };
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestStructuredJson(
  config: OpenAITayqanMeasurementConfig,
  fetchImpl: typeof fetch,
  input: {
    content: Array<Record<string, unknown>>;
    schemaName: string;
    schema: Record<string, unknown>;
    reasoningEffort: "high" | "xhigh" | "max";
    reasoningMode?: "pro";
    timeoutMs: number;
  },
): Promise<{ id: string | null; decoded: unknown }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < REQUEST_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const reasoning: Record<string, unknown> = {
        effort: supportsGpt56Features(config.model)
          ? input.reasoningEffort
          : "high",
      };
      if (supportsGpt56Features(config.model) && input.reasoningMode) {
        reasoning.mode = input.reasoningMode;
      }

      const body: Record<string, unknown> = {
        model: config.model,
        input: [{ role: "user", content: input.content }],
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            strict: true,
            schema: input.schema,
          },
        },
        reasoning,
      };
      if (config.safetyIdentifier) {
        body.safety_identifier = config.safetyIdentifier;
      }

      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const diagnostic = await providerDiagnostic(response);
        console.warn("[tayqan-provider-rejection]", diagnostic);
        if (response.status === 429) {
          throw new NonRetryableOpenAIError(diagnostic);
        }
        const message = `OpenAI TAYQAN request failed with status ${response.status}.`;
        if (attempt + 1 < REQUEST_RETRY_COUNT && shouldRetryStatus(response.status)) {
          lastError = new Error(message);
          await sleep(700 * (attempt + 1));
          continue;
        }
        throw new NonRetryableOpenAIError(diagnostic);
      }

      console.info("[tayqan-provider-ready]", providerResponseMetadata(response));

      const raw = await response.json() as Record<string, unknown>;
      if (raw.status === "incomplete") {
        const incompleteDetails = record(raw.incomplete_details);
        const reason = typeof incompleteDetails?.reason === "string"
          ? incompleteDetails.reason.slice(0, 80)
          : "unspecified";
        throw new AppError(
          "TAYQAN_MEASUREMENT_AI_RESPONSE_INCOMPLETE",
          `TAYQAN's AI provider returned an incomplete measurement response (${reason}). Retry this same assignment; completed work remains preserved.`,
          503,
        );
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(extractOutputText(raw));
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new AppError(
            "TAYQAN_MEASUREMENT_AI_RESPONSE_INVALID",
            "TAYQAN's AI provider returned invalid structured measurement data. Retry this same assignment; completed work remains preserved.",
            503,
          );
        }
        throw error;
      }

      return {
        id: typeof raw.id === "string" ? raw.id : null,
        decoded,
      };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (normalizedError instanceof NonRetryableOpenAIError) throw normalizedError;
      // A provider timeout has already consumed the complete bounded request
      // window. Retrying it inside the same Vercel invocation can only push
      // the durable work-order checkpoint beyond the route budget and leave
      // the protected lease looking permanently RUNNING. Let the work-order
      // retry/resume contract own the next attempt instead.
      if (normalizedError.name === "AbortError") {
        throw new AppError(
          "TAYQAN_MEASUREMENT_AI_TIMEOUT",
          "TAYQAN's AI measurement request reached its controlled time limit. Retry this same assignment; completed work remains preserved.",
          503,
        );
      }
      lastError = normalizedError;
      if (attempt + 1 >= REQUEST_RETRY_COUNT) {
        if (normalizedError instanceof TypeError) {
          throw new AppError(
            "TAYQAN_MEASUREMENT_AI_UNAVAILABLE",
            "TAYQAN could not reach the configured AI provider. Retry this same assignment; completed work remains preserved.",
            503,
          );
        }
        throw normalizedError;
      }
      await sleep(700 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("OpenAI TAYQAN request failed.");
}

async function buildImageContent(
  input: Parameters<TayqanMeasurementReasoner>[0],
  pageIds: readonly string[],
  model: string,
): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [];
  for (const pageId of pageIds) {
    const page = input.bundle.pages.find((candidate) => candidate.id === pageId);
    if (!page?.hasImage) continue;
    const imageDataUrl = await input.loadPageImageDataUrl(pageId);
    if (!imageDataUrl) continue;
    content.push({
      type: "input_text",
      text: `PAGE_IMAGE id=${page.id} file=${page.originalName} page=${page.pageNumber} drawing=${page.drawingNumber ?? ""} revision=${page.revisionNumber ?? ""} title=${page.drawingTitle ?? ""}`,
    });
    content.push({
      type: "input_image",
      image_url: imageDataUrl,
      detail: supportsGpt56Features(model) ? "original" : "high",
    });
  }
  return content;
}

function measurementInstruction(): string {
  return [
    "Act as the measurement engineer inside a senior quantity-surveying team.",
    "Treat the project as a coordinated drawing/specification set, not isolated pages.",
    "Every page may include a persisted controlled classification. Use only VERIFIED categoryPaths for autonomous payable measurements; UNCERTAIN, UNRESOLVED, SUPERSEDED, existing, optional or excluded scope must become a scoped exception instead of a quantity.",
    "Follow plan call-outs into sections, elevations, details and schedules before proposing a measurement.",
    "Respect the frozen source scope, revision identifiers, customer exclusions and authoritative-source policy supplied in governingContext.",
    "When governingContext.industryPolicy is present, treat its selected project industry, supported units, sections, rules and calculation types as mandatory governing context. Drawing titles or inferred disciplines may refine scope inside that policy but must never switch the project to another industry engine.",
    "For an industry-policy run, workPackage must equal exactly one governingContext.industryPolicy.rules[].id. Use that rule's calculationType and resultUnit; if no exact rule fits the evidence, create an UNSUPPORTED_FORMULA or SCOPE_GAP exception instead of inventing a work package.",
    "If a customer names a measurement standard, do not apply unstated clauses from model memory. Apply only standard-specific rules explicitly present in supplied project evidence/configured context; use STANDARD_RULE_UNAVAILABLE whenever a missing rule could change the measured result.",
    "Create professional BOQ scope labels with a workPackage and location where the evidence supports them.",
    "Autonomously choose the PRIMARY measurementMethod for every payable BOQ scope: COUNT, LINEAR, AREA, VOLUME or WEIGHT. The user must not be asked to choose a calculator.",
    "Then choose the specific deterministic calculationType that implements that method. measurementMethod and calculationType must agree with the server mapping.",
    "Choose the method from the PAYABLE BOQ INTENT, not merely the physical object. Example: concrete in F1 footings is VOLUME/CONCRETE_VOLUME; a door is COUNT/COUNT; floor finish is AREA/FLOOR_AREA; pipe/cable route is LINEAR; reinforcement is WEIGHT only when evidence is sufficient.",
    "existingEntities entries carry evidenceSource: DRAWING_PAGE or TABLE_SCHEDULE. TABLE_SCHEDULE entries come from a parsed schedule/CSV/XLSX file, not a rendered drawing page — treat their rows as SCHEDULE_VALUE derivation, not something you visually inspected. A WEIGHT/REINFORCEMENT_WEIGHT measurement needs sufficient schedule/bar evidence specifically; do not propose one from a plan symbol alone when no TABLE_SCHEDULE bar schedule evidence is present.",
    "When existingBoqItems is non-empty, this is an update to an already-priced BOQ: check it before proposing a subject. Do not propose a new subject for scope an existing item already measures. If new evidence contradicts an existing item's quantity or description, do not silently overwrite it — create an exception (SCOPE_GAP for scope the existing item misses, PLAN_SCHEDULE_MISMATCH or the most specific applicable kind for a contradiction) so a human reconciles it.",
    "A physical object can support more than one measurement. supportingChecks never create extra BOQ rows.",
    "Use application=CROSS_CHECK when the supporting calculation only corroborates the primary quantity.",
    "Use application=REPETITION_MULTIPLIER only for an evidence-backed COUNT/COUNT that deterministically repeats one identical primary geometry. The server, not the model, multiplies base geometry by the verified count.",
    "Example: F1 footing concrete may use VOLUME/CONCRETE_VOLUME for one footing and COUNT/COUNT with REPETITION_MULTIPLIER for the verified F1 occurrences.",
    "If the same physical source implies genuinely different payable scopes (for example footing concrete, reinforcement and formwork), return separate subjects. Do not attach multiple primary payable calculators to one existingEntityId; use existingEntityId=null for derived scope candidates when necessary.",
    "If payable intent is ambiguous, use METHOD_SELECTION_UNCERTAIN. If distinct payable scopes cannot be safely separated, use COMPOSITE_SCOPE_REQUIRES_SPLIT. If a supporting check contradicts the primary evidence, use SUPPORTING_CHECK_MISMATCH.",
    "Identify BOQ-measurable scope and evidence-backed deterministic-formula inputs only.",
    "Never output a unit price, rate, cost, margin, total, commercial value or market rate.",
    "Never calculate the final BOQ quantity yourself; the server applies the deterministic formula registry.",
    "Method families are enforced server-side: COUNT=>COUNT; LINEAR=>SKIRTING_LENGTH/PIPE_LENGTH/CABLE_LENGTH; AREA=>FLOOR_AREA/CEILING_AREA/WALL_AREA/PAINT_AREA/PARTITION_AREA/DUCT_SURFACE_AREA/FORMWORK_AREA; VOLUME=>CONCRETE_VOLUME/EXCAVATION_VOLUME; WEIGHT=>REINFORCEMENT_WEIGHT.",
    "Every numeric input must be grounded in explicit printed dimensions, schedules, reconciled counts, stored room geometry, or geometry from a VERIFIED scale.",
    "Detected/unverified scale text is context only and never authorizes scaled geometry.",
    "Printed dimensions may be used without verified scale because they are explicit evidence.",
    "DIRECT_COUNT means you counted clearly identifiable discrete occurrences on one bounded page/schedule source. Use it only when the symbols/rows are unambiguous and each occurrence is visibly distinct.",
    "COUNT_RECONCILIATION means you actually compared at least two independent count sources, such as plan symbols against a schedule; otherwise do not use that derivation.",
    "Do not assume standard wall heights, floor-to-floor heights, typical counts, allowances, wastage, vertical drops or repetition multipliers unless explicitly evidenced.",
    "Do not double-count the same physical scope because it appears on plan, section and schedule. If the same physical scope might already be measured elsewhere and you cannot rule that out with certainty, create DOUBLE_COUNT_RISK instead of silently including or excluding it.",
    "For openings and deductions, cite the page evidence used and do not deduct the same opening twice.",
    "For MEP route lengths, use explicit dimensions or VERIFIED scale geometry only; do not estimate a route by visual impression.",
    "If plan and schedule counts disagree, create PLAN_SCHEDULE_MISMATCH instead of choosing one silently.",
    "If revisions conflict or the same drawing number appears with different revisions in the evidence, create REVISION_CONFLICT.",
    "If specification notes and drawing evidence materially conflict, create SPEC_DRAWING_CONFLICT.",
    "If a cited dimension, count or unit appears implausible for the object described (for example an order-of-magnitude mismatch or a unit that does not fit the object), create UNIT_OR_DIMENSION_ANOMALY instead of proceeding on an implausible value.",
    "If evidence is insufficient, ambiguous or unsupported by a deterministic formula, create an exception instead of guessing.",
    "Reuse existingEntityId only when it clearly represents the same physical scope. Otherwise return null and create a new evidence-backed candidate.",
    "Use only supplied page IDs, existing entity IDs and stored room IDs.",
    "ROOM_GEOMETRY inputs must cite stored room IDs whose scaleVerified field is true.",
    "Every input evidencePageId must also appear in the subject evidencePageIds, and primaryPageId must be included there too.",
    "For each input, evidenceNote must state exactly what was read or reconciled from the cited evidence without hidden assumptions.",
  ].join("\n");
}

function seniorCheckerInstruction(globalReview: boolean): string {
  return [
    "Act as an independent Chief Quantity Surveyor checking another estimator's measurement proposals with the judgement expected of a senior QS with decades of project experience.",
    globalReview
      ? "This is the final cross-cluster reconciliation. Look especially for duplicate scope across disciplines/pages, revision conflicts, inconsistent units, schedule-plan mismatches and missing coordination. projectContext.scheduleEvidence holds schedule/table entities that don't belong to any single cluster — use it to catch a schedule-only scope that no cluster proposal covers. projectContext.existingBoqItems, when non-empty, is the already-priced BOQ this assignment updates — reject a proposal that duplicates an existing item's scope."
      : "This is a bounded cluster peer-check. Use the supplied drawing images and context to verify every proposal against its actual evidence. context.existingBoqItems, when non-empty, is the already-priced BOQ this assignment updates — check it the same way.",
    "You are a checker, not a second estimator: do not invent replacement quantities or rates.",
    "ACCEPT a proposal only when the physical scope, primary measurement method, calculator/formula type, inputs, units, deductions and page provenance are adequately supported.",
    "Independently challenge whether the selected measurementMethod matches the payable BOQ intent. A technically valid formula is still wrong if it measures the wrong commercial/measurement scope.",
    "Check supportingChecks independently. CROSS_CHECK is corroboration only. REPETITION_MULTIPLIER is permitted only for a verified COUNT/COUNT of genuinely identical repeated scope; reject it if geometry, type or revision differs between occurrences.",
    "Reject or raise SUPPORTING_CHECK_MISMATCH if a count/area/volume/weight supporting calculation materially conflicts with the primary proposal.",
    "Reject COMPOSITE_SCOPE_REQUIRES_SPLIT when one source entity is being used to collapse multiple distinct payable scopes that should become separate derived BOQ candidates.",
    "REJECT proposals that rely on guessing, wrong scale authority, stale/conflicting revisions, duplicate scope, wrong units, unsupported formula choice, wrong method selection or materially incomplete evidence.",
    "When rejecting, choose the most specific exceptionKind and cite the relevant page IDs.",
    "Every proposalKey must receive exactly one decision.",
    "Use findings for project-level issues or scope gaps that are not represented by a single rejected proposal.",
    "A scope gap finding should identify measurable work apparently present in the supplied evidence but absent from the candidate plan; do not fabricate its quantity.",
    "Do not treat confidence scores as proof. Check the evidence chain itself.",
    "Do not approve, certify, lock or issue the BOQ. All accepted quantities remain AI-proposed and professional-review pending.",
  ].join("\n");
}

async function runSeniorReview(
  config: OpenAITayqanMeasurementConfig,
  fetchImpl: typeof fetch,
  content: Array<Record<string, unknown>>,
  globalReview: boolean,
): Promise<{ id: string | null; review: TayqanSeniorReview }> {
  const response = await requestStructuredJson(config, fetchImpl, {
    content,
    schemaName: "tayqan_senior_qs_review",
    schema: seniorReviewJsonSchema as unknown as Record<string, unknown>,
    // Production default is xhigh. max/pro is an explicit operator opt-in after
    // representative-project latency/quality validation, never an accidental default.
    reasoningEffort: globalReview && config.useSeniorProMode === true ? "max" : "xhigh",
    reasoningMode: globalReview && config.useSeniorProMode === true ? "pro" : undefined,
    timeoutMs: globalReview && config.useSeniorProMode === true ? 210_000 : 150_000,
  });
  return {
    id: response.id,
    review: tayqanSeniorReviewSchema.parse(response.decoded),
  };
}

function chunkValues<T>(values: readonly T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size),
  );
}

function compactProposalIndex(
  plan: TayqanMeasurementPlan,
  bundle: TayqanMeasurementEvidenceBundle,
) {
  const pageById = new Map(bundle.pages.map((page) => [page.id, page] as const));
  return plan.subjects.map((subject) => ({
    proposalKey: tayqanMeasurementProposalKey(subject),
    entityType: subject.entityType,
    measurementMethod: subject.measurementMethod,
    calculationType: subject.calculationType,
    methodConfidence: subject.methodConfidence,
    supportingChecks: subject.supportingChecks.map((check) => ({
      application: check.application,
      measurementMethod: check.measurementMethod,
      calculationType: check.calculationType,
      confidence: check.confidence,
    })),
    label: subject.label,
    workPackage: subject.workPackage,
    location: subject.location,
    evidence: subject.evidencePageIds.map((pageId) => {
      const page = pageById.get(pageId);
      return {
        pageId,
        drawingNumber: page?.drawingNumber ?? null,
        revisionNumber: page?.revisionNumber ?? null,
        discipline: page?.discipline ?? null,
      };
    }),
  }));
}

export function createOpenAITayqanMeasurementReasoner(
  config: OpenAITayqanMeasurementConfig,
  fetchImpl: typeof fetch = fetch,
): TayqanMeasurementReasoner {
  return async (input): Promise<TayqanMeasurementReasonerResult> => {
    const clusters = buildTayqanMeasurementClusters(
      input.bundle.pages,
      MAX_PAGES_PER_CLUSTER,
    );
    const responseIds: string[] = [];
    const allowedPageIds = new Set(input.bundle.pages.map((page) => page.id));
    let completedClusterReviews = 0;

    const reportClusterProgress = async () => {
      completedClusterReviews += 1;
      await input.onProgress?.({
        phase: "CLUSTER_REVIEW_COMPLETE",
        completed: completedClusterReviews,
        total: clusters.length,
      });
    };

    const checkedClusterPlans = await mapWithConcurrency(
      clusters,
      MAX_CLUSTER_CONCURRENCY,
      async (cluster) => {
        const context = clusterContext(input.bundle, cluster.pageIds);
        const imageContent = await buildImageContent(input, cluster.pageIds, config.model);
        const measurementContent: Array<Record<string, unknown>> = [{
          type: "input_text",
          text: JSON.stringify({
            instruction: measurementInstruction(),
            clusterKey: cluster.key,
            context,
          }),
        }, ...imageContent];

        const measured = await requestStructuredJson(config, fetchImpl, {
          content: measurementContent,
          schemaName: "tayqan_measurement_plan",
          schema: measurementPlanJsonSchema as unknown as Record<string, unknown>,
          reasoningEffort: "high",
          timeoutMs: 120_000,
        });
        if (measured.id) responseIds.push(measured.id);
        const measuredPlan = mergeTayqanMeasurementPlans([
          tayqanMeasurementPlanSchema.parse(measured.decoded),
        ]);

        if (measuredPlan.subjects.length === 0) {
          await reportClusterProgress();
          return {
            plan: measuredPlan,
            acceptedCount: 0,
            rejectedCount: 0,
            findingCount: 0,
            reviewApplied: false,
          };
        }

        const proposals = measuredPlan.subjects.map((subject) => ({
          proposalKey: tayqanMeasurementProposalKey(subject),
          subject,
        }));

        const checkerContent: Array<Record<string, unknown>> = [{
          type: "input_text",
          text: JSON.stringify({
            instruction: seniorCheckerInstruction(false),
            clusterKey: cluster.key,
            context,
            proposals,
            existingExceptions: measuredPlan.exceptions,
          }),
        }, ...imageContent];

        const checked = await runSeniorReview(config, fetchImpl, checkerContent, false);
        if (checked.id) responseIds.push(checked.id);
        const applied = applyTayqanSeniorReview(
          measuredPlan,
          checked.review,
          allowedPageIds,
        );
        await reportClusterProgress();

        return {
          ...applied,
          reviewApplied: true,
        };
      },
    );

    let mergedPlan = mergeTayqanMeasurementPlans(
      checkedClusterPlans.map((entry) => entry.plan),
    );

    let globalReviewApplied = false;
    let globalRejectedCount = 0;
    let globalFindingCount = 0;

    // A single cluster has already received an independent senior-QS check,
    // and its context already includes the bounded project-wide schedule and
    // existing-BOQ evidence. Running the cross-cluster reconciliation again
    // is redundant when there is no second cluster to reconcile and can push
    // the protected pass beyond the 300-second route budget. Multi-cluster
    // projects retain the global reconciliation unchanged.
    if (mergedPlan.subjects.length > 0 && clusters.length > 1) {
      const projectContext = compactProjectContext(input.bundle);
      const allProposalIndex = compactProposalIndex(mergedPlan, input.bundle);
      const preGlobalExceptions = mergedPlan.exceptions;
      const globalReviewedPlans: TayqanMeasurementPlan[] = [];
      const globalReviewBatches = chunkValues(mergedPlan.subjects, GLOBAL_REVIEW_BATCH_SIZE);
      let completedGlobalReviewBatches = 0;

      for (const subjectBatch of globalReviewBatches) {
        const batchPlan = tayqanMeasurementPlanSchema.parse({
          subjects: subjectBatch,
          exceptions: [],
        });
        const proposals = subjectBatch.map((subject) => ({
          proposalKey: tayqanMeasurementProposalKey(subject),
          subject,
        }));
        const globalContent: Array<Record<string, unknown>> = [{
          type: "input_text",
          text: JSON.stringify({
            instruction: seniorCheckerInstruction(true),
            projectContext,
            allProposalIndex,
            focusProposals: proposals,
            instructionForFindings: "Return decisions for every focus proposal. relatedProposalKeys in findings must reference focusProposals only, even when the message identifies a duplicate against the allProposalIndex.",
            existingExceptions: preGlobalExceptions.slice(0, 350),
            evidencePageCoveragePercent: calculateTayqanEvidencePageCoveragePercent(
              mergedPlan,
              input.bundle.pages,
            ),
          }),
        }];

        const globalReview = await runSeniorReview(
          config,
          fetchImpl,
          globalContent,
          true,
        );
        if (globalReview.id) responseIds.push(globalReview.id);
        const applied = applyTayqanSeniorReview(
          batchPlan,
          globalReview.review,
          allowedPageIds,
        );
        globalReviewedPlans.push(applied.plan);
        globalRejectedCount += applied.rejectedCount;
        globalFindingCount += applied.findingCount;
        completedGlobalReviewBatches += 1;
        await input.onProgress?.({
          phase: "GLOBAL_REVIEW_BATCH_COMPLETE",
          completed: completedGlobalReviewBatches,
          total: globalReviewBatches.length,
        });
      }

      mergedPlan = mergeTayqanMeasurementPlans([
        ...globalReviewedPlans,
        { subjects: [], exceptions: preGlobalExceptions },
      ]);
      globalReviewApplied = true;
    }

    const clusterRejectedCount = checkedClusterPlans.reduce(
      (sum, entry) => sum + entry.rejectedCount,
      0,
    );
    const clusterFindingCount = checkedClusterPlans.reduce(
      (sum, entry) => sum + entry.findingCount,
      0,
    );

    return {
      provider: "openai",
      model: config.model,
      responseIds,
      plan: mergedPlan,
      seniorReview: {
        clusterReviewCount: checkedClusterPlans.filter((entry) => entry.reviewApplied).length,
        globalReviewApplied,
        acceptedSubjectCount: mergedPlan.subjects.length,
        rejectedSubjectCount: clusterRejectedCount + globalRejectedCount,
        findingCount: clusterFindingCount + globalFindingCount,
        evidencePageCoveragePercent: calculateTayqanEvidencePageCoveragePercent(
          mergedPlan,
          input.bundle.pages,
        ),
      },
    };
  };
}
