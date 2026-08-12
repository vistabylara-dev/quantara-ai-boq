import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const PROJECT_ID = "guide-actionability-v3";
const BOQ_ID = "guide-actionability-v3-boq";
const FILE_ID = "guide-actionability-v3-file";
const PROJECT_PATH = `/projects/${PROJECT_ID}`;
const BOQ_PATH = `${PROJECT_PATH}/boq`;
const FIXTURE_DATE = "2026-08-13T08:00:00.000Z";

const project = {
  id: PROJECT_ID,
  clientId: "guide-client",
  reference: "QTR-GUIDE-V3",
  name: "Guide Actionability Test Project",
  clientName: "Guide Test Client",
  clientEmail: "guide-client@example.test",
  location: "Dubai, UAE",
  industryId: "construction",
  currency: "AED",
  taxRate: 5,
  language: "en",
  status: "active",
  currentRevision: "R01",
  createdAt: FIXTURE_DATE,
  updatedAt: FIXTURE_DATE,
  description: "Deterministic browser fixture for Guide actionability.",
};

const boq = {
  id: BOQ_ID,
  projectId: PROJECT_ID,
  title: "Guide Test BOQ",
  revision: "R01",
  status: "draft",
  isLocked: false,
  createdAt: FIXTURE_DATE,
  sections: [
    {
      id: "guide-section",
      code: "01",
      title: "Measured Works",
      description: "Guide actionability test section",
      order: 1,
      items: [],
    },
  ],
  totals: {
    directCost: 0,
    landedCost: 0,
    grossProfit: 0,
    grossMarginPercentage: 0,
    subtotal: 0,
    discountPercentage: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  },
};

const guideItem = {
  id: "guide-actionability-v3-item",
  itemNumber: 1,
  itemCode: "GUIDE-01",
  category: "Measured Works",
  description: "Guide fixture item",
  specification: "Deterministic test specification",
  quantity: 1,
  unit: "m2",
  unitCost: 100,
  freightCost: 0,
  installationCost: 0,
  additionalCost: 0,
  landedCost: 100,
  marginMode: "markup",
  marginPercentage: 10,
  sellingRate: 110,
  totalAmount: 110,
  wastagePercentage: 0,
  taxApplicable: true,
  sourceReference: "guide-source.pdf",
  roomOrZone: "Test zone",
  drawingReference: "A-001",
  confidenceScore: 100,
  status: "DRAFT",
  notes: "",
  options: [],
};

const editableBoq = {
  ...boq,
  sections: [
    {
      ...boq.sections[0],
      items: [guideItem],
    },
  ],
};

const lockedBoq = {
  ...editableBoq,
  status: "locked",
  isLocked: true,
  lockedAt: FIXTURE_DATE,
  lockedByUserId: "guide-user",
};

const projectFile = {
  id: FILE_ID,
  projectId: PROJECT_ID,
  originalName: "guide-source.pdf",
  mimeType: "application/pdf",
  extension: "pdf",
  fileSize: 12_345,
  processingCapability: {
    mode: "PDF_TEXT",
    canClassify: true,
    canRenderPages: true,
    canExtractTables: true,
    message: "Supported test source.",
  },
  classification: "BOQ",
  classificationConfidence: 98,
  classificationConfirmedAt: FIXTURE_DATE,
  status: "COMPLETED",
  pageCount: 2,
  drawingNumber: null,
  drawingTitle: null,
  revisionNumber: "A",
  processingErrorCode: null,
  processingErrorMessage: null,
  metadata: {},
  uploadedBy: {
    id: "guide-user",
    fullName: "Guide Test Owner",
    email: "guide-owner@example.test",
  },
  createdAt: FIXTURE_DATE,
};

const reviewedEntity = {
  id: "guide-reviewed-entity",
  projectId: PROJECT_ID,
  projectFileId: FILE_ID,
  entityType: "AREA_MEASUREMENT",
  label: "Reviewed floor area",
  quantity: 125,
  unit: "m2",
  confidence: 98,
  extractionMethod: "TABLE_EXTRACTION",
  sourceText: "Floor finish area: 125 m2",
  status: "CONFIRMED",
  correction: null,
  confirmedAt: FIXTURE_DATE,
  rejectedAt: null,
};

const workflowSnapshot = {
  projectId: PROJECT_ID,
  projectSlug: PROJECT_ID,
  files: {
    total: 1,
    manualOriginCount: 1,
    googleDriveOriginCount: 0,
    statusCounts: { COMPLETED: 1 },
    processingErrorCount: 0,
    needsReviewCount: 0,
    classifiedCount: 1,
    revisionedCount: 1,
  },
  processingJobs: {
    total: 1,
    queued: 0,
    running: 0,
    completed: 1,
    failed: 0,
    needsReview: 0,
    cancelled: 0,
    storedResultCount: 1,
  },
  capturedResults: {
    pageCount: 2,
    tableCount: 1,
    storedJobResultCount: 1,
    artifactCount: null,
  },
  extractedEntities: {
    total: 1,
    needsReview: 0,
    confirmed: 1,
    corrected: 0,
    rejected: 0,
    imported: 0,
    unknown: 0,
  },
  boq: { exists: true },
  sources: [
    {
      id: FILE_ID,
      name: projectFile.originalName,
      origin: "Uploaded manually",
      status: "COMPLETED",
      currentJobStatus: "COMPLETED",
      currentJobStatusesByEngine: { TABLE_EXTRACTION: "COMPLETED" },
      hasProcessingError: false,
      needsReview: false,
      isProcessing: false,
      hasCapturedResults: true,
      pageCount: 2,
      tableCount: 1,
      classification: "BOQ",
      revisionNumber: "A",
    },
  ],
};

const verification = {
  boq,
  exceptions: [],
  summary: {
    unresolvedCritical: 0,
    unresolvedWarning: 0,
    resolved: 0,
    lockBlocked: false,
    lockEligible: true,
  },
};

type ApiHarness = {
  nonGetRequests: string[];
};

function apiPayload(pathname: string): unknown {
  if (pathname === "/api/auth/session") {
    return {
      authenticated: true,
      user: {
        fullName: "Guide Test Owner",
        email: "guide-owner@example.test",
        role: "COMPANY_OWNER",
        platformRole: null,
      },
    };
  }
  if (pathname === "/api/admin/simulation") return { simulation: null };
  if (pathname === "/api/templates") {
    return [
      {
        id: "guide-template",
        name: "Guide Test Template",
        code: "GUIDE_TEST",
        type: "BOQ",
        description: "Deterministic Guide test template",
        isDefault: true,
        isActive: true,
      },
    ];
  }
  if (pathname === "/api/items/search") return { items: [] };
  if (pathname === `/api/boqs/${BOQ_ID}/validation-preview`) return [];
  if (pathname === `/api/boqs/${BOQ_ID}/verification`) return verification;

  const projectApiPath = `/api/projects/${PROJECT_ID}`;
  if (pathname === projectApiPath) return project;
  if (pathname === `${projectApiPath}/proposals`) return [];
  if (pathname === `${projectApiPath}/boqs`) return [boq];
  if (pathname === `${projectApiPath}/workflow-snapshot`) return workflowSnapshot;
  if (pathname === `${projectApiPath}/files`) return [projectFile];
  if (pathname === `${projectApiPath}/extractions`) return [reviewedEntity];
  if (pathname === `${projectApiPath}/quantity-calculations`) {
    return [
      {
        id: "guide-calculation",
        extractedEntityId: reviewedEntity.id,
        status: "CONFIRMED",
      },
    ];
  }
  if (pathname === `${projectApiPath}/documents`) return [];

  // Keep incidental shell GETs deterministic. Test assertions below target
  // the live page result, so an unneeded ancillary request cannot reach a
  // database or external provider.
  return [];
}

async function installApiHarness(page: Page, context: BrowserContext): Promise<ApiHarness> {
  const harness: ApiHarness = { nonGetRequests: [] };

  await context.addCookies([
    {
      name: "quantara_session",
      value: "guide-v3-fake-session-no-db",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method !== "GET") {
      harness.nonGetRequests.push(`${method} ${url.pathname}${url.search}`);
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "GUIDE_E2E_WRITE_BLOCKED",
            message: "Guide actionability tests never permit API mutations.",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: apiPayload(url.pathname) }),
    });
  });

  return harness;
}

const test = base.extend<{ apiHarness: ApiHarness }>({
  apiHarness: [
    async ({ page, context }, use) => {
      const harness = await installApiHarness(page, context);
      await use(harness);
      expect(
        harness.nonGetRequests,
        "Guide navigation and UI intents must remain read-only",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

async function expectPath(page: Page, expectedPath: string) {
  await expect.poll(
    () => {
      const url = new URL(page.url());
      return `${url.pathname}${url.search}`;
    },
    { timeout: 15_000 },
  ).toBe(expectedPath);
}

async function openProjectGuide(page: Page) {
  await page.goto(PROJECT_PATH);
  await expect(
    page.getByRole("heading", { name: "Project intelligence guide" }),
  ).toBeVisible({ timeout: 40_000 });
}

async function overrideProjectBoqs(page: Page, revisions: unknown[]) {
  await page.route(`**/api/projects/${PROJECT_ID}/boqs`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: revisions }),
    });
  });
}

async function followStageRecommendation(
  page: Page,
  destination: {
    stage: string;
    cta: string;
    path: string;
    heading: string;
  },
) {
  await openProjectGuide(page);
  await page.getByRole("button", {
    name: `Open guidance for ${destination.stage}`,
  }).click();

  const dialog = page.getByRole("dialog", { name: destination.stage });
  await dialog.getByRole("link", { name: destination.cta }).click();

  await expectPath(page, destination.path);
  await expect(
    page.getByRole("heading", { name: destination.heading }),
  ).toBeVisible({ timeout: 40_000 });
}

test.describe("Quantara Guide actionability V3", () => {
  // Next.js dev-mode compiles each protected route on first use. Keeping this
  // focused regression suite serial avoids seven workers contending for the
  // same cold compiler and gives the first route an honest startup budget.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, testInfo) => testInfo.setTimeout(90_000));

  test("hover-open Sources CTA accepts pointer interaction and reaches the live Files workspace", async ({ page }) => {
    await openProjectGuide(page);

    const trigger = page.getByRole("button", { name: "Open guidance for Sources" });
    await trigger.hover();

    const dialog = page.getByRole("dialog", { name: "Sources" });
    const cta = dialog.getByRole("link", { name: "Review Project Sources" });
    await expect(dialog).toBeVisible();
    await expect(cta).toBeVisible();

    // Moving from the trigger into the popover must not close it before a
    // professional can click the recommended action.
    await cta.hover();
    await page.waitForTimeout(300);
    await expect(cta).toBeVisible();
    await cta.click();

    await expectPath(page, `${PROJECT_PATH}/files`);
    await expect(
      page.getByRole("heading", { name: "Source documents and processing" }),
    ).toBeVisible({ timeout: 40_000 });
  });

  test("Escape closes a hover-open tip without stealing unrelated focus", async ({ page }) => {
    await openProjectGuide(page);

    const trigger = page.getByRole("button", { name: "Open guidance for Sources" });
    const dialog = page.getByRole("dialog", { name: "Sources" });
    const unrelatedControl = page.getByRole("link", { name: project.clientName, exact: true });

    await trigger.hover();
    await expect(dialog).toBeVisible();
    await unrelatedControl.focus();
    await expect(dialog).toBeVisible();
    await expect(unrelatedControl).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).not.toBeVisible();
    await expect(unrelatedControl).toBeFocused();
  });

  test("Project Setup local CTA produces an observable same-page focus result", async ({ page }) => {
    await openProjectGuide(page);

    await page.getByRole("button", { name: "Open guidance for Project Setup" }).click();
    const dialog = page.getByRole("dialog", { name: "Project Setup" });
    const cta = dialog.getByRole("button", { name: "Open Project Overview" });
    await expect(cta).toBeVisible();
    await cta.click();

    await expectPath(page, PROJECT_PATH);
    await expect(page.locator("#project-overview-section")).toBeFocused();
  });

  test("Files local CTA accepts Tab and Enter and focuses the source list", async ({ page }) => {
    await page.goto(`${PROJECT_PATH}/files`);
    await expect(
      page.getByRole("heading", { name: "Source documents and processing" }),
    ).toBeVisible({ timeout: 40_000 });

    const trigger = page.getByRole("button", { name: "Open guidance for project sources" });
    await trigger.focus();

    const dialog = page.getByRole("dialog", { name: "Project sources" });
    const cta = dialog.getByRole("button", { name: "Review source list" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");

    await expectPath(page, `${PROJECT_PATH}/files`);
    await expect(page.locator("#project-source-list")).toBeFocused();
  });

  test("Space opens the Extraction tip, Tab reaches its CTA, and Enter navigates", async ({ page }) => {
    await openProjectGuide(page);

    const trigger = page.getByRole("button", { name: "Open guidance for Extraction" });
    const dialog = page.getByRole("dialog", { name: "Extraction" });
    const cta = dialog.getByRole("link", { name: "Review Extracted Information" });

    // Focus opens the disclosure; Escape must close it and restore focus to
    // the trigger instead of dropping keyboard users into the document body.
    await trigger.focus();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();

    // A pinned disclosure must also honor outside-click dismissal.
    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
    await page.getByRole("heading", { name: "Project intelligence guide" }).click();
    await expect(dialog).not.toBeVisible();

    // Reopen from the keyboard and complete the action using Tab then Enter.
    await trigger.focus();
    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");

    await expectPath(page, `${PROJECT_PATH}/extractions`);
    await expect(
      page.getByRole("heading", { name: "Review extracted project information" }),
    ).toBeVisible({ timeout: 40_000 });
  });

  test("Validation recommendation reaches the real verification workspace", async ({ page }) => {
    await followStageRecommendation(page, {
      stage: "Validation",
      cta: "Open Validation Checks",
      path: `${PROJECT_PATH}/verification`,
      heading: `${project.name} checks`,
    });
  });

  test("Output recommendation reaches the real document workspace", async ({ page }) => {
    await followStageRecommendation(page, {
      stage: "Output",
      cta: "Open Documents",
      path: `${PROJECT_PATH}/documents`,
      heading: `${project.name} document package`,
    });
  });

  test("direct Dimensions and Calculations intents normalize, repeat in one mount, and stay one-shot on reload", async ({ page }) => {
    await page.goto(`${BOQ_PATH}?action=review_dimensions`);

    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });
    await expectPath(page, BOQ_PATH);

    const addItemHeading = page.getByRole("heading", { name: "Add item", exact: true });
    await expect(addItemHeading).toBeVisible();
    await expect(page.getByText("Professionally reviewed project information")).toBeVisible();
    await expect(page.getByRole("button", { name: reviewedEntity.label })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // Next.js integrates native history mutations with useSearchParams. A
    // second supported intent in the same mounted BOQ page must be consumed;
    // a permanent one-shot boolean would incorrectly ignore this action.
    await page.evaluate((href) => window.history.pushState(null, "", href), `${BOQ_PATH}?action=review_calculations`);
    await expect(addItemHeading).toBeVisible();
    await expectPath(page, BOQ_PATH);
    await page.getByRole("button", { name: "Close" }).click();

    // The action was removed from the URL, so a normal reload must not replay
    // the workflow or reopen the modal.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });
    await expectPath(page, BOQ_PATH);
    await expect(addItemHeading).toHaveCount(0);
  });

  test("a BOQ-less Guide dimension intent focuses creation choices without creating a BOQ", async ({ page }) => {
    await overrideProjectBoqs(page, []);

    await page.goto(`${BOQ_PATH}?action=review_dimensions`);
    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });
    await expectPath(page, BOQ_PATH);

    await expect(page.locator("#boq-start-workflow")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Add item", exact: true })).toHaveCount(0);
  });

  test("locked BOQ Guide actions preserve read-only state without mutations", async ({ page, apiHarness }) => {
    await overrideProjectBoqs(page, [lockedBoq]);
    await page.goto(BOQ_PATH);
    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });

    const quantityInput = page
      .locator("#boq-editor-section tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .getByRole("spinbutton");
    await expect(page.getByText("This revision is locked and read-only.")).toBeVisible();
    await expect(quantityInput).toBeDisabled();

    for (const action of ["review_dimensions", "review_calculations"]) {
      await page.evaluate((href) => window.history.pushState(null, "", href), `${BOQ_PATH}?action=${action}`);
      await expectPath(page, BOQ_PATH);
      await expect(page.getByRole("alert").filter({
        hasText: "This BOQ revision is locked. Create a new revision before adding or changing reviewed measurements.",
      })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add item", exact: true })).toHaveCount(0);
      await expect(quantityInput).toBeDisabled();
      await page.getByRole("button", { name: "Dismiss" }).click();
    }

    await page.evaluate((href) => window.history.pushState(null, "", href), `${BOQ_PATH}?action=view_boq`);
    await expectPath(page, BOQ_PATH);
    await expect(page.locator("#boq-editor-section")).toBeFocused();
    await expect(quantityInput).toBeDisabled();
    expect(apiHarness.nonGetRequests).toEqual([]);
  });

  test("unsaved BOQ Guide actions preserve edits and existing guards without mutations", async ({ page, apiHarness }) => {
    await overrideProjectBoqs(page, [editableBoq]);
    await page.goto(BOQ_PATH);
    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });

    const quantityInput = page
      .locator("#boq-editor-section tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .getByRole("spinbutton");
    await quantityInput.fill("2");
    await expect(quantityInput).toHaveValue("2");
    await expect(page.getByRole("button", { name: "Add item", exact: true }).first()).toBeDisabled();

    for (const action of ["review_dimensions", "review_calculations"]) {
      await page.evaluate((href) => window.history.pushState(null, "", href), `${BOQ_PATH}?action=${action}`);
      await expectPath(page, BOQ_PATH);
      await expect(page.getByRole("alert").filter({
        hasText: "Save the current BOQ changes before adding or importing another item. Your unsaved edits will not be discarded.",
      })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add item", exact: true })).toHaveCount(0);
      await expect(quantityInput).toHaveValue("2");
      await page.getByRole("button", { name: "Dismiss" }).click();
    }

    await page.evaluate((href) => window.history.pushState(null, "", href), `${BOQ_PATH}?action=view_boq`);
    await expectPath(page, BOQ_PATH);
    await expect(page.locator("#boq-editor-section")).toBeFocused();
    await expect(quantityInput).toHaveValue("2");
    expect(apiHarness.nonGetRequests).toEqual([]);
  });

  test("direct BOQ intent normalizes and visibly focuses the existing editor", async ({ page }) => {
    await page.goto(`${BOQ_PATH}?action=view_boq`);

    await expect(
      page.getByRole("heading", { name: `${project.name} BOQ` }),
    ).toBeVisible({ timeout: 40_000 });
    await expectPath(page, BOQ_PATH);

    const editor = page.locator("#boq-editor-section");
    await expect(editor).toBeFocused();
    await expect(page.getByRole("heading", { name: "Add item", exact: true })).toHaveCount(0);
  });

  test("unsupported and malformed BOQ actions are inert, normalized, and read-only", async ({ page }) => {
    const rejectedQueries = [
      "action=approve_and_lock",
      "action=review_dimensions&action=view_boq",
    ];

    for (const query of rejectedQueries) {
      await page.goto(`${BOQ_PATH}?${query}`);
      await expect(
        page.getByRole("heading", { name: `${project.name} BOQ` }),
      ).toBeVisible({ timeout: 40_000 });
      await expectPath(page, BOQ_PATH);

      await expect(page.getByRole("heading", { name: "Add item", exact: true })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? "")).not.toBe("boq-editor-section");
    }
  });

  test.describe("mobile touch", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    test("CTA remains tappable and the popup cannot create horizontal overflow", async ({ page }) => {
      await openProjectGuide(page);

      const trigger = page.getByRole("button", { name: "Open guidance for Output" });
      await trigger.tap();

      const dialog = page.getByRole("dialog", { name: "Output" });
      const cta = dialog.getByRole("link", { name: "Open Documents" });
      await expect(dialog).toBeVisible();
      await expect(cta).toBeVisible();

      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);

      const overflow = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

      await cta.tap();
      await expectPath(page, `${PROJECT_PATH}/documents`);
      await expect(
        page.getByRole("heading", { name: `${project.name} document package` }),
      ).toBeVisible({ timeout: 40_000 });
    });
  });
});
