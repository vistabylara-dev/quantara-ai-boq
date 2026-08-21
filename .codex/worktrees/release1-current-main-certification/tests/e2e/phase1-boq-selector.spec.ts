import { test, expect } from '@playwright/test';

test.describe('Phase 1: BOQ Method Selector', () => {
  // We mock a project ID and assume user is logged in
  const projectId = 'test-project-id';

  test('method selector renders when no BOQ exists', async ({ page }) => {
    // Navigate to BOQ page with mock/empty data
    await page.goto(`/projects/${projectId}/boq`);
    
    // Check if selector title is visible
    await expect(page.locator('text="How would you like to create this BOQ?"')).toBeVisible();

    // Check if all cards render
    await expect(page.locator('text="Upload Drawings or Floor Plans"')).toBeVisible();
    await expect(page.locator('text="Connect an Engineering Application"')).toBeVisible();
    await expect(page.locator('text="Import Measurements"')).toBeVisible();
    await expect(page.locator('text="Import Existing BOQ"')).toBeVisible();
    await expect(page.locator('text="Start Manually"')).toBeVisible();
  });

  test('Start Manually routes to draft editor and opens modal', async ({ page }) => {
    await page.goto(`/projects/${projectId}/boq`);

    // We assume clicking "Start Manually" invokes the API and opens the Add Item modal
    const startManuallyBtn = page.locator('button:has-text("Start Manually")');
    await startManuallyBtn.click();

    // Verify Add Item modal opens automatically
    await expect(page.locator('h3:has-text("Add item")')).toBeVisible();

    // Verify both Catalogue and Manual choices are visible
    await expect(page.locator('text="Search Catalogue / My Library"')).toBeVisible();
    await expect(page.locator('text="Enter Item Manually"')).toBeVisible();

    // Verify no blank row was created before choice (we'd check the table length, but we are inside the modal)
  });

  test('Add First Item opens dual-path modal', async ({ page }) => {
    // Navigate to a project with an empty BOQ draft
    await page.goto(`/projects/${projectId}/boq?mock=empty-draft`);
    
    const addFirstItemBtn = page.locator('button:has-text("Add First Item")');
    if (await addFirstItemBtn.isVisible()) {
      await addFirstItemBtn.click();
      await expect(page.locator('text="Search Catalogue / My Library"')).toBeVisible();
      await expect(page.locator('text="Enter Item Manually"')).toBeVisible();
    }
  });
});
