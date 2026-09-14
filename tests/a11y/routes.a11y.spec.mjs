import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/playground/', '/3d/', '/lab/', '/room/', '/tunnel/', '/about/', '/engineering/'];
for (const route of routes) {
  test(`${route} has no critical axe violations`, async ({ page }) => {
    await page.goto(route, { waitUntil:'domcontentloaded' });
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((violation) => violation.impact === 'critical');
    if (results.violations.length) {
      console.log(`axe ${route}: ${results.violations.length} findings, ${critical.length} critical`);
    }
    expect(critical).toEqual([]);
  });
}
