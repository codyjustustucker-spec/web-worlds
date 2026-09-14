import { test, expect } from '@playwright/test';

const routes = ['/', '/playground/', '/3d/', '/lab/', '/room/', '/tunnel/', '/about/', '/engineering/'];
for (const route of routes) {
  test(`${route} boots without an uncaught page error`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(route, { waitUntil:'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('main')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('unknown routes return the custom 404 without losing navigation', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-real-world', { waitUntil:'domcontentloaded' });
  expect(response?.status()).toBe(404);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).toContainText('This door opens into drywall.');
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
});
