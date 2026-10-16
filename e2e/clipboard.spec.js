import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

// The web and desktop apps (Chromium, Electron) load the plugin in a
// sandboxed iframe with no allow="clipboard-write", where the async
// clipboard API is refused; Firefox does not apply that policy.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } });

test('copies from the sandboxed iframe the apps use', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const plugin = await openHost(page, { text: 'GET https://a.example/x\n', snSandbox: true });

  await plugin.getByRole('button', { name: 'Copy as cURL' }).click();

  await expect(plugin.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "curl -X GET 'https://a.example/x'"
  );
});
