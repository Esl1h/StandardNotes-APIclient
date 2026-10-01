import { test, expect } from '@playwright/test';

/**
 * Deterministic end to end flow over the hosted demo page:
 * the app under test is the same build the plugin serves.
 *
 * The external endpoint is stubbed so the suite does not depend on the
 * network: everything else (CodeMirror editing, parser, block rendering,
 * runner and pretty print) is the real shipped code.
 */
test('demo edits a request, runs it and renders an inline response', async ({ page }) => {
  await page.route('**/echo.local/**', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ hello: 'world' }),
    })
  );

  await page.goto('/demo.html');

  // Write a new scenario through the real editor (CodeMirror).
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('### Echo test\nGET http://echo.local/anything\n');

  // Run and wait for the inline response.
  await page.locator('.block .run').first().click();
  await expect(page.locator('.block .status')).toHaveText('201');
  const body = page.locator('.block .response-body');
  await expect(body).toContainText('"hello": "world"');
  // JSON bodies display pretty printed (one property per line).
  await expect(body).toContainText('\n  "hello"');

  // The copy affordance exists for the raw body.
  await expect(page.locator('.block .copy-body')).toBeVisible();
});
