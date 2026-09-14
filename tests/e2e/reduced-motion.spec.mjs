import { test, expect } from '@playwright/test';

test('reduced motion keeps the home page usable', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion:'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.world-route').first()).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await context.close();
});

test('reduced motion keeps Tunnel content available', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion:'reduce' });
  const page = await context.newPage();
  await page.goto('/tunnel/');
  await expect(page.locator('main')).toBeVisible();
  await context.close();
});
