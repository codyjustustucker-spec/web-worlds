import { test, expect } from '@playwright/test';

async function openThemeControlsIfNeeded(page) {
  const menu = page.locator('.menu-button');
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
}

async function chooseTheme(page, theme) {
  await openThemeControlsIfNeeded(page);
  const button = page.locator(`[data-theme-choice="${theme}"]:visible`).first();
  await expect(button).toBeVisible();
  await button.click();
  return button;
}

test('all four themes activate and persist between routes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['cute','royal','scary','cool']) {
    const button = await chooseTheme(page, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(button).toHaveAttribute('aria-pressed','true');
  }
  await chooseTheme(page, 'royal');
  await page.goto('/engineering/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','royal');
});

test('current navigation item is exposed with aria-current', async ({ page }) => {
  await page.goto('/engineering/');
  await expect(page.locator('[data-room-link="engineering"]')).toHaveAttribute('aria-current','page');
});
