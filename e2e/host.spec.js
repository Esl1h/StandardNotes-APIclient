import { test, expect } from '@playwright/test';
import { openHost, hostLogs } from './snHost.js';

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

test('opening a note does not save it, typing saves once', async ({ page }) => {
  const plugin = await openHost(page, { text: JSON_NOTE });
  await expect(plugin.locator('.block')).toHaveCount(1);

  // The EditorKit coalesces saves for 350 ms; wait past that before asserting.
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(0);

  await plugin.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('#');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);
  const [save] = await hostLogs(page, 'save-items');
  expect(save.text).toBe(`${JSON_NOTE}#`);
});

test('undo does not bring back the text of the previous note', async ({ page }) => {
  const plugin = await openHost(page, { text: 'GET https://note-a.example\n' });
  const content = plugin.locator('.cm-content');
  await expect(content).toContainText('note-a');

  await content.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('# typed in a');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);

  await page.evaluate(() => window.sendNote('n2', 'GET https://note-b.example\n'));
  await expect(content).toContainText('note-b');

  await content.click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(content).toContainText('note-b');
  await expect(content).not.toContainText('note-a');
  await page.waitForTimeout(800);
  expect(await hostLogs(page, 'save-items')).toHaveLength(1);
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
