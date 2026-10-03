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
