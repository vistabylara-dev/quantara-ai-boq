import { describe, expect, it, vi } from "vitest";
import type { WorkerAssignmentRecord } from "../src/lib/services/worker-review-service";
import {
  buildBoundedPlannerInput,
  createOpenAIWorkerPlanner,
} from "../src/lib/worker/openai-worker-planner";

const IDS = {
  assignment: "00000000-0000-4000-8000-000000000101",
  boq: "00000000-0000-4000-8000-000000000102",
  item: "00000000-0000-4000-8000-000000000103",
  decision: "00000000-0000-4000-8000-000000000104",
  question: "00000000-0000-4000-8000-000000000105",
  invented: "00000000-0000-4000-8000-000000000999",
};

function assignmentFixture(): WorkerAssignmentRecord {
  return {
    id: IDS.assignment,
    companyId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    boqId: IDS.boq,
    assignmentType: "REVIEW_EXISTING_BOQ",
    status: "NEEDS_INPUT",
    inspectionVersion: "test",
    inspectionAsOf: new Date("2026-01-01T00:00:00.000Z"),
    sourceBoqVersion: 1,
    sourceVerifiedVersion: null,
    sourceRevisionNumber: 1,
    requestedByUserId: null,
    requestedByName: "Reviewer",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:00:01.000Z"),
    failureCode: null,
    failureMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:01.000Z"),
    workspace: {
      id: "00000000-0000-4000-8000-000000000106",
      companyId: "00000000-0000-4000-8000-000000000001",
      projectId: "00000000-0000-4000-8000-000000000002",
      boqId: IDS.boq,
      assignmentId: IDS.assignment,
      conclusion: "NEEDS_INPUT",
      sectionCount: 1,
      itemCount: 1,
      activeItemCount: 1,
      confirmedQuantityCount: 0,
      confirmedRateCount: 0,
      unresolvedCriticalCount: 0,
      unresolvedWarningCount: 0,
      revisionEvidenceCount: 0,
      summaryJson: {},
      itemsJson: [{
        boqItemId: IDS.item,
        sectionCode: "S-01",
        itemCode: "ITEM-01",
        description: "Steel door",
        quantity: "37.5",
        unit: "EA",
        unitCost: "912.25",
        freightCost: "44.00",
        marginPercentage: "18.0",
        quantityIntegrity: { state: "MISSING" },
        rateIntegrity: { state: "MISMATCH" },
      }],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    decisions: [{
      id: IDS.decision,
      companyId: "00000000-0000-4000-8000-000000000001",
      projectId: "00000000-0000-4000-8000-000000000002",
      boqId: IDS.boq,
      assignmentId: IDS.assignment,
      sequenceNumber: 1,
      code: "QUANTITY_PROVENANCE_MISSING",
      outcome: "NEEDS_INPUT",
      severity: "MATERIAL",
      subjectType: "BOQItem",
      subjectId: IDS.item,
      summary: "Quantity evidence needs professional action.",
      rationaleJson: {},
      evidenceRefsJson: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }],
    materialQuestions: [{
      id: IDS.question,
      companyId: "00000000-0000-4000-8000-000000000001",
      projectId: "00000000-0000-4000-8000-000000000002",
      boqId: IDS.boq,
      assignmentId: IDS.assignment,
      decisionId: IDS.decision,
      questionType: "CONFIRM_QUANTITY_PROVENANCE",
      status: "OPEN",
      subjectType: "BOQItem",
      subjectId: IDS.item,
      prompt: "What governed evidence confirms this item?",
      whyMaterial: "Evidence is required.",
      recommendedAction: "Review the source.",
      answeredByUserId: null,
      answerJson: null,
      answeredAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }],
    events: [],
  };
}

function responseFor(subjectId: string) {
  return new Response(JSON.stringify({
    id: "resp_test_123",
    output: [{
      content: [{
        type: "output_text",
        text: JSON.stringify({
          summary: "Review missing evidence with a qualified estimator.",
          priority: "HIGH",
          actions: [{
            kind: "REVIEW_MATERIAL_QUESTION",
            subjectType: "WorkerMaterialQuestion",
            subjectId,
            rationale: "The deterministic review marked this evidence as material.",
          }],
          cautions: ["Do not change governed values from this advisory plan."],
          requiresHumanReview: true,
        }),
      }],
    }],
    usage: { input_tokens: 100, output_tokens: 40 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("bounded OpenAI worker planner", () => {
  it("removes commercial numeric values from the bounded context", () => {
    const input = buildBoundedPlannerInput(assignmentFixture());

    expect(input.context.items[0]).toMatchObject({
      id: IDS.item,
      quantityIntegrityState: "MISSING",
      rateIntegrityState: "MISMATCH",
    });
    expect(input.contextJson).not.toContain("37.5");
    expect(input.contextJson).not.toContain("912.25");
    expect(input.contextJson).not.toContain("unitCost");
    expect(input.contextJson).not.toContain("freightCost");
    expect(input.contextJson).not.toContain("marginPercentage");
    expect(input.contextSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("makes exactly one strict Responses API call and revalidates the output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseFor(IDS.question));
    const planner = createOpenAIWorkerPlanner({ apiKey: "private-test-key", model: "test-model" }, fetchMock);

    const result = await planner(buildBoundedPlannerInput(assignmentFixture()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer private-test-key" });
    const requestBody = JSON.parse(String(init?.body));
    expect(requestBody.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(requestBody.text.format.schema.additionalProperties).toBe(false);
    expect(result.plan.requiresHumanReview).toBe(true);
    expect(result.providerResponseId).toBe("resp_test_123");
  });

  it("rejects a model-invented subject identity", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseFor(IDS.invented));
    const planner = createOpenAIWorkerPlanner({ apiKey: "private-test-key", model: "test-model" }, fetchMock);

    await expect(planner(buildBoundedPlannerInput(assignmentFixture())))
      .rejects.toThrow("outside the bounded context");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not hide an internal provider retry", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const planner = createOpenAIWorkerPlanner({ apiKey: "private-test-key", model: "test-model" }, fetchMock);

    await expect(planner(buildBoundedPlannerInput(assignmentFixture())))
      .rejects.toThrow("status 503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
