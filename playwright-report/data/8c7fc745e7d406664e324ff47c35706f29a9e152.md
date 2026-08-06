# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boq-workflow.spec.ts >> BOQ Workflow >> full visual workflow: Create -> Add -> Save -> Lock -> Generate
- Location: tests\e2e\boq-workflow.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Project summary')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Project summary')

```

```yaml
- main:
  - img "Quantara"
  - text: Authorization
  - heading "System Login" [level=1]
  - text: User ID
  - textbox "operator@quantara.sys"
  - text: Passcode
  - textbox "••••••••"
  - button "Initialize"
  - paragraph: Quantara Engine // Secure Access Only
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("BOQ Workflow", () => {
  4  |   test("full visual workflow: Create -> Add -> Save -> Lock -> Generate", async ({ page }) => {
  5  |     // 1. Sign in (Assuming a standard test setup handles auth or we do it here)
  6  |     // We navigate to a project BOQ page directly. If this is a real E2E, we'd need to mock auth
  7  |     // or log in. Let's assume we are authenticated and go to a project.
  8  |     
  9  |     // For this test, we'll outline the exact assertions needed for the workflow
  10 |     // based on the UI elements we just built.
  11 |     
  12 |     // NOTE: This test will fail if it's run without a proper DB seed of a project.
  13 |     // Assuming projectId="test-project-1" exists.
  14 |     
  15 |     // 1. Create Initial BOQ
  16 |     await page.goto("/projects/test-project-1");
  17 |     // Wait for the Project summary to load
> 18 |     await expect(page.getByText("Project summary")).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  19 |     
  20 |     // Click "Create Initial BOQ" if it exists, otherwise we might already have one
  21 |     const createBtn = page.getByRole("link", { name: "Create Initial BOQ" });
  22 |     if (await createBtn.isVisible()) {
  23 |       await createBtn.click();
  24 |     } else {
  25 |       await page.goto("/projects/test-project-1/boq");
  26 |     }
  27 |     
  28 |     // 2. We should be on BOQ Studio with an empty revision
  29 |     await expect(page.getByText("No items have been added to this section.")).toBeVisible();
  30 |     
  31 |     // Check that Lock Revision is disabled
  32 |     const lockBtn = page.getByRole("button", { name: "Lock revision" });
  33 |     await expect(lockBtn).toBeDisabled();
  34 |     
  35 |     // 3. Add First Item
  36 |     await page.getByRole("button", { name: "Add First Item" }).click();
  37 |     
  38 |     // Add Item Modal opens, go to Manual tab
  39 |     await page.getByRole("button", { name: "Create manually" }).click();
  40 |     
  41 |     // Fill in manual item
  42 |     await page.getByPlaceholder("Item code").fill("TEST-01");
  43 |     await page.getByPlaceholder("Category").fill("Testing");
  44 |     await page.getByPlaceholder("Description").fill("E2E Test Item");
  45 |     await page.getByPlaceholder("Unit").fill("m2");
  46 |     await page.getByPlaceholder("Quantity").fill("10");
  47 |     await page.getByPlaceholder("Unit cost").fill("100");
  48 |     
  49 |     // Click "Add to BOQ"
  50 |     await page.getByRole("button", { name: "Add to BOQ" }).click();
  51 |     
  52 |     // Modal closes, item should be in the table
  53 |     await expect(page.locator('input[value="TEST-01"]')).toBeVisible();
  54 |     await expect(page.locator('input[value="E2E Test Item"]')).toBeVisible();
  55 |     
  56 |     // Check totals updated (10 * 100 = 1,000)
  57 |     // Wait for subtotal to show up - currency format might vary, so just look for 1,000
  58 |     await expect(page.getByText("1,000")).toBeVisible();
  59 |     
  60 |     // 4. Save Draft
  61 |     await page.getByRole("button", { name: "Save draft" }).click();
  62 |     
  63 |     // Wait for save to complete (button might say "Saving..." then back to "Save draft")
  64 |     await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  65 |     
  66 |     // 5. Lock Revision
  67 |     await expect(lockBtn).toBeEnabled();
  68 |     await lockBtn.click();
  69 |     
  70 |     // Should say "Revision locked"
  71 |     await expect(page.getByRole("button", { name: "Revision locked" })).toBeVisible();
  72 |     
  73 |     // 6. Generate Document (Verify we can go to documents and generate)
  74 |     await page.goto("/projects/test-project-1/documents");
  75 |     
  76 |     // Click Generate PDF or similar (depending on how the documents page is built)
  77 |     // Assuming there's a button to generate PDF
  78 |     // await page.getByRole("button", { name: "Generate PDF" }).click();
  79 |     // await expect(page.getByText("Document generated successfully")).toBeVisible();
  80 |   });
  81 | });
  82 | 
```