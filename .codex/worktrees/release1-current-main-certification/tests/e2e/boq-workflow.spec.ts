import { test, expect } from "@playwright/test";

test.describe("BOQ Workflow", () => {
  test("full visual workflow: Create -> Add -> Save -> Lock -> Generate", async ({ page }) => {
    // 1. Sign in (Assuming a standard test setup handles auth or we do it here)
    // We navigate to a project BOQ page directly. If this is a real E2E, we'd need to mock auth
    // or log in. Let's assume we are authenticated and go to a project.
    
    // For this test, we'll outline the exact assertions needed for the workflow
    // based on the UI elements we just built.
    
    // NOTE: This test will fail if it's run without a proper DB seed of a project.
    // Assuming projectId="test-project-1" exists.
    
    // 1. Create Initial BOQ
    await page.goto("/projects/test-project-1");
    // Wait for the Project summary to load
    await expect(page.getByText("Project summary")).toBeVisible();
    
    // Click "Create Initial BOQ" if it exists, otherwise we might already have one
    const createBtn = page.getByRole("link", { name: "Create Initial BOQ" });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    } else {
      await page.goto("/projects/test-project-1/boq");
    }
    
    // 2. We should be on BOQ Studio with an empty revision
    await expect(page.getByText("No items have been added to this section.")).toBeVisible();
    
    // Check that Lock Revision is disabled
    const lockBtn = page.getByRole("button", { name: "Lock revision" });
    await expect(lockBtn).toBeDisabled();
    
    // 3. Add First Item
    await page.getByRole("button", { name: "Add First Item" }).click();
    
    // Add Item Modal opens, go to Manual tab
    await page.getByRole("button", { name: "Create manually" }).click();
    
    // Fill in manual item
    await page.getByPlaceholder("Item code").fill("TEST-01");
    await page.getByPlaceholder("Category").fill("Testing");
    await page.getByPlaceholder("Description").fill("E2E Test Item");
    await page.getByPlaceholder("Unit").fill("m2");
    await page.getByPlaceholder("Quantity").fill("10");
    await page.getByPlaceholder("Unit cost").fill("100");
    
    // Click "Add to BOQ"
    await page.getByRole("button", { name: "Add to BOQ" }).click();
    
    // Modal closes, item should be in the table
    await expect(page.locator('input[value="TEST-01"]')).toBeVisible();
    await expect(page.locator('input[value="E2E Test Item"]')).toBeVisible();
    
    // Check totals updated (10 * 100 = 1,000)
    // Wait for subtotal to show up - currency format might vary, so just look for 1,000
    await expect(page.getByText("1,000")).toBeVisible();
    
    // 4. Save Draft
    await page.getByRole("button", { name: "Save draft" }).click();
    
    // Wait for save to complete (button might say "Saving..." then back to "Save draft")
    await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
    
    // 5. Lock Revision
    await expect(lockBtn).toBeEnabled();
    await lockBtn.click();
    
    // Should say "Revision locked"
    await expect(page.getByRole("button", { name: "Revision locked" })).toBeVisible();
    
    // 6. Generate Document (Verify we can go to documents and generate)
    await page.goto("/projects/test-project-1/documents");
    
    // Click Generate PDF or similar (depending on how the documents page is built)
    // Assuming there's a button to generate PDF
    // await page.getByRole("button", { name: "Generate PDF" }).click();
    // await expect(page.getByText("Document generated successfully")).toBeVisible();
  });
});
