import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

// The mobile app runs its web UI from a local file inside a WebView, so the
// host origin is "null". An opaque-origin page may not load localhost, where
// the plugin is served in tests; in the app it comes from a public host.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

test('loads the note when the host origin is opaque, as in the mobile app', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const plugin = await openHost(page, {
    text: 'GET https://a.example\n\n### Two\nGET https://b.example\n',
    opaqueOrigin: true,
  });

  await expect(plugin.locator('.block')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test('the split width survives reopening without localStorage', async ({ page }) => {
  // Below 640 px the divider is hidden; the opaque origin also blocks
  // localStorage, as in the app's sandbox.
  await page.setViewportSize({ width: 1280, height: 800 });
  const note = 'GET https://a.example\n';
  const plugin = await openHost(page, { text: note, opaqueOrigin: true });
  // The divider is 0 px wide (its grab area is a pseudo element), so
  // Playwright cannot click it; the double click is dispatched instead.
  const divider = plugin.locator('.divider');
  await expect(plugin.locator('.block')).toHaveCount(1);
  const stored = () => page.evaluate(() => window.componentData['split-pct']);
  await divider.dispatchEvent('dblclick');
  await expect.poll(stored).toBe('38');

  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(768, box.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await stored())).toBeGreaterThan(50);
  const saved = await page.evaluate(() => window.componentData);

  const reopened = await openHost(page, { text: note, opaqueOrigin: true, componentData: saved });
  const width = () =>
    reopened
      .locator('.raw-editor-container')
      .evaluate((element) => element.style.getPropertyValue('--editor-width'));
  await expect.poll(width).not.toBe('38%');
  expect(parseFloat(await width())).toBeGreaterThan(50);
});
