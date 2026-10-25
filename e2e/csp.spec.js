import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

// See mobile-origin.spec.js: the opaque host may not load localhost.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

const NOTE = 'GET https://a.example\n\n### Two\nGET https://b.example\n';

/** Collects the CSP violations the page and its frames report. */
function watchViolations(page) {
  const violations = [];
  page.on('console', (message) => {
    if (/Content Security Policy/.test(message.text())) violations.push(message.text());
  });
  return violations;
}

// The built pages carry a Content Security Policy; loading a note must not
// trip it, in the web host or in the opaque-origin mobile one.
for (const opaqueOrigin of [false, true]) {
  test(`the editor loads without a CSP violation${opaqueOrigin ? ', opaque origin' : ''}`, async ({
    page,
  }) => {
    const violations = watchViolations(page);

    const plugin = await openHost(page, { text: NOTE, opaqueOrigin });

    await expect(plugin.locator('.block')).toHaveCount(2);
    await expect(plugin.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
    expect(violations).toEqual([]);
  });
}

test('the policy leaves requests to any endpoint alone', async ({ page }) => {
  const violations = watchViolations(page);
  await page.route('**/echo.local/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  await page.goto('/demo.html');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('GET http://echo.local/anything\n');
  await page.locator('.block .run').first().click();

  await expect(page.locator('.block .status')).toHaveText('200');
  expect(violations).toEqual([]);
});
