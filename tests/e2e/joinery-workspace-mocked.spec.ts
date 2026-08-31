import {
  expect,
  test,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

const PROJECT_ID = "joinery-browser-project";
const PROJECT_FILE_ID = "joinery-browser-source";
const BOQ_ID = "joinery-browser-boq";
const PART_REVIEW_ID = "part-review";
const PART_EXCLUDE_ID = "part-false-positive";
const ORDER_REVIEW_ID = "order-review";
const ORDER_EXCLUDE_ID = "order-false-positive";

type ReviewIssue = {
  code: string;
  field: string;
  severity: "REVIEW" | "BLOCKING";
  message: string;
  evidenceReferences: string[];
};

type CandidateEntry = {
  id: string;
  projectId: string;
  projectFileId: string;
  status: string;
  candidate: Record<string, any>;
  correction: unknown;
  confirmedAt: string | null;
  rejectedAt: string | null;
};

type CapturedRequest = {
  method: string;
  pathname: string;
  body: unknown;
};

function envelope(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function reading(valueMm: number | null, evidenceReference: string) {
  return {
    raw: valueMm === null ? "" : String(valueMm),
    valueMm,
    source: "SOURCE",
    evidenceReference,
    hasConflict: false,
  };
}

function partCandidate(input: {
  id: string;
  part: string;
  rowNumber: number;
  issues?: ReviewIssue[];
}) {
  const rowReference = `Cutting List!A${input.rowNumber}`;
  return {
    candidateId: `furniture-candidate-v1:${input.id}`,
    mappingVersion: "furniture-candidate-v1",
    discipline: "JOINERY_CABINETRY",
    room: "KITCHEN",
    elevationReference: "ELEV-A",
    assembly: "Base cabinet",
    assemblyGroupKey: `kitchen|elev-a|${input.id}`,
    part: input.part,
    quantity: 2,
    dimensions: {
      width: reading(600, rowReference),
      height: reading(720, rowReference),
      depth: reading(560, rowReference),
      thickness: reading(18, rowReference),
    },
    material: { raw: "MDF (Oak)", name: "MDF", finish: "Oak" },
    edgeBanding: {
      raw: "All four edges",
      mode: "ALL_FOUR",
      selectedEdges: [
        { dimension: "WIDTH", count: 2 },
        { dimension: "HEIGHT", count: 2 },
      ],
      orientation: "EXPLICIT",
    },
    grainDirection: "Vertical",
    hardwareNotes: [],
    notes: null,
    evidence: {
      sourceFileId: PROJECT_FILE_ID,
      sourceFileName: "joinery-browser-fixture.xlsx",
      sourceKind: "WORKBOOK",
      method: "TABLE_PARSER",
      sourceTableId: "parts-table",
      sourceRowId: `parts-row-${input.rowNumber}`,
      sheetName: "Cutting List",
      pageNumber: null,
      rowNumber: input.rowNumber,
      drawingReference: "ELEV-A",
      confidence: 96,
      sourceCellReferences: [rowReference],
      rawCells: { part: input.part, width_mm: "600" },
    },
    issues: input.issues ?? [],
    verificationStatus: "READY_FOR_REVIEW",
  };
}

function orderCandidate(input: {
  id: string;
  description: string;
  rowNumber: number;
  issues?: ReviewIssue[];
}) {
  const rowReference = `Hardware & Accessories BOQ!A${input.rowNumber}`;
  const candidate = {
    id: `furniture-order-item-v1:${input.id}`,
    description: input.description,
    quantity: 12,
    quantityText: "12",
    unit: null,
    category: "UNCLASSIFIED",
    suppliedByOthers: false,
    notes: "Base cabinet doors",
    mappingVersion: "furniture-order-item-v1",
    verificationStatus: "NEEDS_REVIEW",
    issues: [] as ReviewIssue[],
    evidence: {
      sheetName: "Hardware & Accessories BOQ",
      rowNumber: input.rowNumber,
      sourceCellReferences: [rowReference],
      sourceTableId: "order-table",
      sourceRowId: `order-row-${input.rowNumber}`,
      sourceFileId: PROJECT_FILE_ID,
      sourceFileName: "joinery-browser-fixture.xlsx",
      sourceKind: "WORKBOOK",
      pageNumber: null,
      confidence: 94,
      method: "TABLE_PARSER",
      sourceTableKey: "Hardware & Accessories BOQ:0",
      sourceRowKey: `${input.rowNumber}:0`,
      rawCells: { description: input.description, quantity: "12" },
    },
  };
  candidate.issues = input.issues ?? deriveOrderIssues(candidate);
  return candidate;
}

function deriveOrderIssues(candidate: Record<string, any>): ReviewIssue[] {
  const evidenceReferences = candidate.evidence?.sourceCellReferences ?? [];
  const issues: ReviewIssue[] = [];
  if (!Number.isFinite(candidate.quantity) || candidate.quantity <= 0) {
    issues.push({
      code: candidate.quantity === null ? "MISSING_QUANTITY" : "INVALID_QUANTITY",
      field: "quantity",
      severity: "BLOCKING",
      message: "A positive numeric order quantity is required.",
      evidenceReferences,
    });
  }
  if (!candidate.unit?.trim()) {
    issues.push({
      code: "MISSING_UNIT",
      field: "unit",
      severity: "BLOCKING",
      message: "Enter the ordering unit before approval.",
      evidenceReferences,
    });
  }
  if (candidate.category === "UNCLASSIFIED") {
    issues.push({
      code: "CATEGORY_REQUIRES_REVIEW",
      field: "category",
      severity: "BLOCKING",
      message: "Select an explicit order category before approval.",
      evidenceReferences,
    });
  }
  return issues;
}

function candidateEntry(id: string, candidate: Record<string, any>): CandidateEntry {
  return {
    id,
    projectId: PROJECT_ID,
    projectFileId: PROJECT_FILE_ID,
    status: "NEEDS_REVIEW",
    candidate,
    correction: null,
    confirmedAt: null,
    rejectedAt: null,
  };
}

function reviewPartEntry() {
  return candidateEntry(PART_REVIEW_ID, partCandidate({
    id: PART_REVIEW_ID,
    part: "Door panel",
    rowNumber: 5,
    issues: [{
      code: "FINISH_REQUIRES_VERIFICATION",
      field: "finish",
      severity: "REVIEW",
      message: "Confirm the finish against the approved sample.",
      evidenceReferences: ["Cutting List!A5"],
    }],
  }));
}

function falsePositivePartEntry() {
  return candidateEntry(PART_EXCLUDE_ID, partCandidate({
    id: PART_EXCLUDE_ID,
    part: "Duplicate scribble",
    rowNumber: 6,
  }));
}

function reviewOrderEntry() {
  return candidateEntry(ORDER_REVIEW_ID, orderCandidate({
    id: ORDER_REVIEW_ID,
    description: "Soft-close concealed hinge",
    rowNumber: 7,
  }));
}

function falsePositiveOrderEntry() {
  return candidateEntry(ORDER_EXCLUDE_ID, orderCandidate({
    id: ORDER_EXCLUDE_ID,
    description: "Duplicate hinge note",
    rowNumber: 8,
  }));
}

function requestBody(request: Request): Record<string, any> {
  return (request.postDataJSON() ?? {}) as Record<string, any>;
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: envelope(data),
  });
}

async function installJoineryMocks(
  page: Page,
  input: {
    candidates?: CandidateEntry[];
    orderItems?: CandidateEntry[];
  } = {},
) {
  let candidates = clone(input.candidates ?? [reviewPartEntry()]);
  let orderItems = clone(input.orderItems ?? [reviewOrderEntry()]);
  const correctionRequests: CapturedRequest[] = [];
  const approvalRequests: CapturedRequest[] = [];
  const rejectionRequests: CapturedRequest[] = [];
  const generationRequests: CapturedRequest[] = [];
  const unexpectedRequests: CapturedRequest[] = [];

  await page.context().addCookies([{
    name: "quantara_session",
    value: "joinery-browser-session-presence-only",
    url: "http://localhost:3000",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "quantara:marketing-lead-dashboard-session:v1",
      "shown",
    );
  });

  const candidateCollection = `/api/projects/${PROJECT_ID}/joinery/candidates`;
  const orderCollection = `/api/projects/${PROJECT_ID}/joinery/order-items`;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    const staticGetData: Record<string, unknown> = {
      "/api/auth/session": {
        authenticated: true,
        user: {
          id: "joinery-browser-user",
          companyId: "joinery-browser-company",
          role: "COMPANY_OWNER",
          fullName: "Joinery Browser Reviewer",
          email: "joinery-reviewer@example.test",
          platformRole: null,
          customerPreviewActive: false,
        },
      },
      "/api/admin/simulation": { simulation: null },
      "/api/entitlements": { trialUsage: null },
      "/api/dashboard/metrics": {
        activeProjects: 1,
        totalClients: 1,
        totalBoqs: 1,
        totalUploadedFiles: 1,
        totalGeneratedDocuments: 0,
        catalogueItems: 0,
        pendingApprovals: candidates.length + orderItems.length,
        failedOperations: 0,
      },
      "/api/dashboard/activity": [],
      "/api/dashboard/subscription-summary": {
        companyName: "Joinery Browser Company",
        planName: null,
        planType: null,
        status: "NONE",
        trialExpiresAt: null,
        startsAt: null,
        expiresAt: null,
      },
    };

    if (method === "GET" && pathname in staticGetData) {
      await fulfill(route, staticGetData[pathname]);
      return;
    }

    if (method === "GET" && pathname === `/api/projects/${PROJECT_ID}`) {
      await fulfill(route, {
        id: PROJECT_ID,
        name: "Joinery Browser Project",
        reference: "JOINERY-E2E-001",
        industryId: "joinery",
      });
      return;
    }

    if (method === "GET" && pathname === candidateCollection) {
      await fulfill(route, clone(candidates));
      return;
    }

    if (method === "GET" && pathname === orderCollection) {
      await fulfill(route, clone(orderItems));
      return;
    }

    if (method === "GET" && pathname === `/api/projects/${PROJECT_ID}/boqs`) {
      await fulfill(route, [{
        id: BOQ_ID,
        title: "Joinery browser BOQ",
        revision: "R01",
        status: "draft",
        isLocked: false,
      }]);
      return;
    }

    if (pathname.startsWith(`${candidateCollection}/`)) {
      const segments = pathname.slice(candidateCollection.length + 1).split("/");
      const id = decodeURIComponent(segments[0] ?? "");
      const action = segments[1] ?? null;
      const index = candidates.findIndex((entry) => entry.id === id);
      if (index >= 0 && method === "PATCH" && action === null) {
        const body = requestBody(request);
        correctionRequests.push({ method, pathname, body });
        const current = candidates[index];
        const currentCandidate = current.candidate;
        const dimensions = body.dimensions as Record<string, number | null>;
        const nextCandidate = {
          ...currentCandidate,
          room: body.room,
          elevationReference: body.elevationReference,
          assembly: body.assembly,
          part: body.part,
          quantity: body.quantity,
          dimensions: Object.fromEntries(
            Object.entries(currentCandidate.dimensions as Record<string, Record<string, unknown>>)
              .map(([key, value]) => [key, {
                ...value,
                raw: dimensions[key] === null ? "" : String(dimensions[key]),
                valueMm: dimensions[key],
              }]),
          ),
          material: {
            ...currentCandidate.material,
            name: body.materialName,
            finish: body.finish,
          },
          grainDirection: body.grainDirection,
          hardwareNotes: body.hardwareNotes,
          edgeBanding: body.edgeBanding,
          notes: body.notes,
        };
        candidates[index] = {
          ...current,
          status: "CORRECTED",
          candidate: nextCandidate,
          correction: body,
        };
        await fulfill(route, clone(candidates[index]));
        return;
      }
      if (index >= 0 && method === "POST" && action === "approve") {
        const body = requestBody(request);
        approvalRequests.push({ method, pathname, body });
        candidates[index] = {
          ...candidates[index],
          status: "CONFIRMED",
          candidate: {
            ...candidates[index].candidate,
            verificationStatus: "APPROVED_LOCKED",
          },
          correction: body,
          confirmedAt: "2026-08-31T12:00:00.000Z",
          rejectedAt: null,
        };
        await fulfill(route, clone(candidates[index]));
        return;
      }
      if (index >= 0 && method === "POST" && action === "reject") {
        const body = requestBody(request);
        rejectionRequests.push({ method, pathname, body });
        candidates[index] = {
          ...candidates[index],
          status: "REJECTED",
          correction: body,
          rejectedAt: "2026-08-31T12:02:00.000Z",
        };
        await fulfill(route, clone(candidates[index]));
        return;
      }
    }

    if (pathname.startsWith(`${orderCollection}/`)) {
      const segments = pathname.slice(orderCollection.length + 1).split("/");
      const id = decodeURIComponent(segments[0] ?? "");
      const action = segments[1] ?? null;
      const index = orderItems.findIndex((entry) => entry.id === id);
      if (index >= 0 && method === "PATCH" && action === null) {
        const body = requestBody(request);
        correctionRequests.push({ method, pathname, body });
        const correctedCandidate = {
          ...orderItems[index].candidate,
          description: body.description,
          quantity: body.quantity,
          quantityText: String(body.quantity),
          unit: body.unit,
          category: body.category,
          suppliedByOthers: body.suppliedByOthers,
          notes: body.notes,
        };
        const issues = deriveOrderIssues(correctedCandidate);
        orderItems[index] = {
          ...orderItems[index],
          status: "CORRECTED",
          candidate: {
            ...correctedCandidate,
            issues,
            verificationStatus: issues.length > 0 ? "BLOCKED" : "CORRECTED",
          },
          correction: body,
        };
        await fulfill(route, clone(orderItems[index]));
        return;
      }
      if (index >= 0 && method === "POST" && action === "approve") {
        const body = requestBody(request);
        const blockingIssues = deriveOrderIssues(orderItems[index].candidate);
        if (blockingIssues.length > 0) {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              ok: false,
              error: {
                code: "FURNITURE_ORDER_VERIFICATION_BLOCKED",
                message: "Resolve missing or invalid quantity, unit, and category values before approval.",
              },
            }),
          });
          return;
        }
        approvalRequests.push({ method, pathname, body });
        orderItems[index] = {
          ...orderItems[index],
          status: "CONFIRMED",
          candidate: {
            ...orderItems[index].candidate,
            verificationStatus: "APPROVED_LOCKED",
          },
          correction: body,
          confirmedAt: "2026-08-31T12:01:00.000Z",
          rejectedAt: null,
        };
        await fulfill(route, clone(orderItems[index]));
        return;
      }
      if (index >= 0 && method === "POST" && action === "reject") {
        const body = requestBody(request);
        rejectionRequests.push({ method, pathname, body });
        orderItems[index] = {
          ...orderItems[index],
          status: "REJECTED",
          correction: body,
          rejectedAt: "2026-08-31T12:03:00.000Z",
        };
        await fulfill(route, clone(orderItems[index]));
        return;
      }
    }

    if (
      method === "POST"
      && pathname === `/api/projects/${PROJECT_ID}/joinery/generate-boq`
    ) {
      const body = requestBody(request);
      generationRequests.push({ method, pathname, body });
      await fulfill(route, {
        createdItems: 8,
        updatedItems: 0,
        removedManagedItems: 1,
        preservedManualItems: 2,
      });
      return;
    }

    const body = method === "GET" ? null : requestBody(request);
    unexpectedRequests.push({ method, pathname, body });
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "UNEXPECTED_MOCK_REQUEST",
          message: `No mocked response exists for ${method} ${pathname}.`,
        },
      }),
    });
  });

  return {
    correctionRequests,
    approvalRequests,
    rejectionRequests,
    generationRequests,
    unexpectedRequests,
  };
}

async function openWorkspace(page: Page) {
  await page.goto(`/projects/${PROJECT_ID}/joinery`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", {
    name: "Verified assemblies, parts and order quantities",
  })).toBeVisible();
}

function partCard(page: Page, partName: string) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name: new RegExp(partName, "i") }),
  });
}

function orderCard(page: Page, description: string) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name: description, exact: true }),
  });
}

function generateButton(page: Page) {
  return page.getByRole("button", {
    name: "Generate material BOQ, hardware BOQ & cutting list",
  });
}

async function approvePart(page: Page, partName: string) {
  const card = partCard(page, partName);
  const acknowledgement = card.getByRole("checkbox", {
    name: /I reviewed and acknowledge/i,
  });
  if (await acknowledgement.count()) await acknowledgement.check();
  await card.getByRole("button", { name: "Approve & lock" }).click();
  await expect(card.getByText("Approved & locked")).toBeVisible();
}

async function approveOrderItem(page: Page, description: string) {
  const card = orderCard(page, description);
  const acknowledgement = card.getByRole("checkbox", {
    name: /I reviewed and acknowledge/i,
  });
  if (await acknowledgement.count()) await acknowledgement.check();
  await card.getByRole("button", { name: "Approve & lock" }).click();
  await expect(card.getByText("Approved & locked")).toBeVisible();
}

test.describe("Joinery workspace mocked browser acceptance", () => {
  test("sends part and order corrections and approvals to their governed endpoints", async ({ page }) => {
    const api = await installJoineryMocks(page);
    await openWorkspace(page);

    const initialPartCard = partCard(page, "Door panel");
    await initialPartCard.getByLabel("Part", { exact: true }).fill("Reviewed door front");
    await expect(initialPartCard.getByRole("button", { name: "Approve & lock" })).toBeDisabled();
    await expect(initialPartCard.getByText("Save correction before approval")).toBeVisible();
    await initialPartCard.getByLabel("Correction or exclusion reason")
      .fill("Checked the approved elevation and sample schedule");
    await initialPartCard.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Correction saved with its original source evidence.")).toBeVisible();

    await expect(partCard(page, "Reviewed door front").getByRole("button", {
      name: "Approve & lock",
    })).toBeEnabled();
    await approvePart(page, "Reviewed door front");

    const order = orderCard(page, "Soft-close concealed hinge");
    await order.getByLabel("Ordering unit").fill("pcs");
    await order.getByLabel("Order category").selectOption("HARDWARE");
    await order.getByLabel("Correction or exclusion reason")
      .fill("Checked supplier hardware schedule");
    await order.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Hardware/order item correction saved with source evidence.")).toBeVisible();

    await approveOrderItem(page, "Soft-close concealed hinge");

    expect(api.correctionRequests).toHaveLength(2);
    expect(api.correctionRequests[0]).toMatchObject({
      method: "PATCH",
      pathname: `/api/projects/${PROJECT_ID}/joinery/candidates/${PART_REVIEW_ID}`,
      body: {
        part: "Reviewed door front",
        reason: "Checked the approved elevation and sample schedule",
      },
    });
    expect(api.correctionRequests[1]).toMatchObject({
      method: "PATCH",
      pathname: `/api/projects/${PROJECT_ID}/joinery/order-items/${ORDER_REVIEW_ID}`,
      body: {
        unit: "pcs",
        category: "HARDWARE",
        reason: "Checked supplier hardware schedule",
      },
    });
    expect(api.approvalRequests).toEqual([
      {
        method: "POST",
        pathname: `/api/projects/${PROJECT_ID}/joinery/candidates/${PART_REVIEW_ID}/approve`,
        body: { acknowledgedIssueCodes: ["FINISH_REQUIRES_VERIFICATION"] },
      },
      {
        method: "POST",
        pathname: `/api/projects/${PROJECT_ID}/joinery/order-items/${ORDER_REVIEW_ID}/approve`,
        body: { acknowledgedIssueCodes: [] },
      },
    ]);
    expect(api.generationRequests).toEqual([]);
    expect(api.unexpectedRequests).toEqual([]);
  });

  test("keeps generation disabled while any active review row is incomplete", async ({ page }) => {
    const api = await installJoineryMocks(page);
    await openWorkspace(page);

    const generate = generateButton(page);
    await expect(generate).toBeDisabled();

    await approvePart(page, "Door panel");
    await expect(generate).toBeDisabled();

    await generate.evaluate((element) => (element as HTMLButtonElement).click());
    await expect.poll(() => api.generationRequests.length).toBe(0);
    expect(api.approvalRequests).toHaveLength(1);
    expect(api.unexpectedRequests).toEqual([]);
  });

  test("excludes false positives and generates only after every active row is confirmed", async ({ page }) => {
    const api = await installJoineryMocks(page, {
      candidates: [reviewPartEntry(), falsePositivePartEntry()],
      orderItems: [reviewOrderEntry(), falsePositiveOrderEntry()],
    });
    await openWorkspace(page);

    const generate = generateButton(page);
    await expect(generate).toBeDisabled();

    await approvePart(page, "Door panel");
    const validOrder = orderCard(page, "Soft-close concealed hinge");
    await validOrder.getByLabel("Ordering unit").fill("pcs");
    await validOrder.getByLabel("Order category").selectOption("HARDWARE");
    await validOrder.getByLabel("Correction or exclusion reason")
      .fill("Checked supplier hardware schedule before generation");
    await validOrder.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Hardware/order item correction saved with source evidence.")).toBeVisible();
    await approveOrderItem(page, "Soft-close concealed hinge");
    await expect(generate).toBeDisabled();

    const falsePart = partCard(page, "Duplicate scribble");
    const falseOrder = orderCard(page, "Duplicate hinge note");
    const excludePart = falsePart.getByRole("button", {
      name: "Exclude false positive",
    });
    const excludeOrder = falseOrder.getByRole("button", {
      name: "Exclude false positive",
    });

    await falsePart.getByLabel("Correction or exclusion reason")
      .fill("Duplicate annotation, not a manufactured part");
    page.once("dialog", (dialog) => dialog.accept());
    await excludePart.click();

    await falseOrder.getByLabel("Correction or exclusion reason")
      .fill("Duplicate note, not a separately ordered item");
    page.once("dialog", (dialog) => dialog.accept());
    await excludeOrder.click();

    expect(api.rejectionRequests).toEqual([
      {
        method: "POST",
        pathname: `/api/projects/${PROJECT_ID}/joinery/candidates/${PART_EXCLUDE_ID}/reject`,
        body: { reason: "Duplicate annotation, not a manufactured part" },
      },
      {
        method: "POST",
        pathname: `/api/projects/${PROJECT_ID}/joinery/order-items/${ORDER_EXCLUDE_ID}/reject`,
        body: { reason: "Duplicate note, not a separately ordered item" },
      },
    ]);

    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.getByText(/Five-section output regenerated \(8 created, 0 updated, 1 stale managed rows removed\)/)).toBeVisible();

    expect(api.generationRequests).toEqual([{
      method: "POST",
      pathname: `/api/projects/${PROJECT_ID}/joinery/generate-boq`,
      body: { boqId: BOQ_ID, wastagePercentage: 10 },
    }]);
    expect(api.unexpectedRequests).toEqual([]);
  });
});
