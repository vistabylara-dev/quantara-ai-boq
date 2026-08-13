import { test, expect } from '@playwright/test';

test.describe('Homepage Shell Verification', () => {
  test('homepage has exactly one unified PublicHeader and correct triggers', async ({ page }) => {
    await page.goto('/');

    // Check banner role
    const banners = await page.locator('header[role="banner"]');
    await expect(banners).toHaveCount(1);

    // Verify exactly one logo (with alt "Quantara Logo") inside the header
    const headerLogos = await banners.locator('img[alt="Quantara Logo"]');
    await expect(headerLogos).toHaveCount(1);
    
    // Check triggers
    const triggers = ['Platform', 'Solutions', 'Resources', 'Comparisons', 'Regional', 'Company'];
    for (const trigger of triggers) {
      const button = await banners.locator(`button:has-text("${trigger}")`);
      await expect(button).toBeVisible();
    }
    
    // Check account setup
    const accountSetupBtn = await banners.locator('a:has-text("Start Account Setup")').first();
    await expect(accountSetupBtn).toBeVisible();
  });
});
