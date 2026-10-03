import { test, expect } from '@playwright/test';
import { openHost } from './snHost.js';

const JSON_NOTE = [
  '### Create',
  'POST https://httpbin.org/post',
  'Content-Type: application/json',
  '',
  '{',
  '  "a": 1',
  '}',
  '',
].join('\n');

test('a note with an indented JSON body renders the editor and its blocks', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const plugin = await openHost(page, { text: JSON_NOTE });

  await expect(plugin.locator('.cm-editor')).toBeVisible();
  await expect(plugin.locator('.block')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test.describe('mobile WebView with a slow CPU', () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });

  // The registration message is sent once; a lost race means the note never
  // loads, so repeat to catch intermittent failures.
  for (let run = 1; run <= 10; run++) {
    test(`registers before the iframe load event, run ${run}`, async ({ page }) => {
      const plugin = await openHost(page, { text: JSON_NOTE, throttle: 30 });

      await expect(plugin.locator('.block')).toHaveCount(1);
    });
  }
});
