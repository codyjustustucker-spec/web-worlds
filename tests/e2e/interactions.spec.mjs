import { test, expect } from '@playwright/test';

test('mobile navigation opens and closes with Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile interaction');
  await page.goto('/');
  const button = page.locator('.menu-button');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded','false');
});

test('Playground exposes its primary interactive stage', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('body[data-page="playground"]')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
});

test('Engineering page loads release evidence and live checks', async ({ page }) => {
  await page.goto('/engineering/');
  await expect(page.locator('[data-release-version]')).toContainText('0.27');
  await expect(page.locator('[data-live-checks] li').first()).toBeVisible();
  await expect(page.locator('[data-live-summary]')).toContainText(/passing now|waiting/i);
});


test('Brick Breaker leaderboard degrades safely before the Worker endpoint is configured', async ({ page, isMobile }) => {
  await page.goto('/playground/');

  const board = page.locator(
    isMobile
      ? '[data-leaderboard-mode="brick-breaker-mobile"]'
      : '[data-leaderboard-mode="brick-breaker"]'
  );

  const stage = page.locator(
    isMobile
      ? '[data-mobile-breaker-room]'
      : '[data-pg-breaker-stage]'
  );

  await expect(board).toBeVisible();
  await expect(board.locator('[data-leaderboard-status]'))
    .toContainText(/deploy|configure|backend|online/i);
  await expect(stage).toBeVisible();
});

test('Engineering full-stack panel stays honest when backend is not configured', async ({ page }) => {
  await page.goto('/engineering/');
  await expect(page.locator('[data-backend-api-status]')).toContainText(/pending|awaiting|deployment/i);
  await expect(page.locator('[data-backend-db-status]')).toContainText(/pending|awaiting|deployment/i);
});
