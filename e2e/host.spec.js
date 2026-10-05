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

test('the caret follows the theme color on a dark background', async ({ page }) => {
  const plugin = await openHost(page, { text: JSON_NOTE });
  const content = plugin.locator('.cm-content');
  await expect(content).toBeVisible();

  // The app sets the stylekit variables; simulate the dark theme inside
  // the plugin iframe, as the Standard Notes app does.
  await content.evaluate((element) => {
    const root = element.ownerDocument.documentElement;
    root.style.setProperty('--sn-stylekit-contrast-background-color', '#151718');
    root.style.setProperty('--sn-stylekit-editor-foreground-color', '#e8ebee');
  });

  // CodeMirror hides the native caret and draws .cm-cursor instead, with
  // a hardcoded black border (its dark variant needs a dark theme); only
  // a more specific rule keeps the drawn caret visible in the dark theme.
  await content.click();
  await expect
    .poll(() =>
      plugin.locator('.cm-cursor').first().evaluate((el) => getComputedStyle(el).borderLeftColor)
    )
    .toBe('rgb(232, 235, 238)');
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
  expect(save.preview).toBe('1 request: POST Create');
});

test('a late echo of an earlier save does not undo newer typing', async ({ page }) => {
  const plugin = await openHost(page, { text: JSON_NOTE });
  await expect(plugin.locator('.block')).toHaveCount(1);
  await plugin.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('A');
  await expect.poll(async () => (await hostLogs(page, 'save-items')).length).toBe(1);
  const [first] = await hostLogs(page, 'save-items');

  await page.keyboard.type('B');
  // The app streams the first save back once the second one is queued.
  await page.evaluate((text) => window.sendNote('n1', text), first.text);
  await page.waitForTimeout(800);
  await expect(plugin.locator('.cm-line').last()).toHaveText('AB');

  // Typing on continues from what the user had, not from the echo.
  await page.keyboard.type('C');
  const lastSaved = async () => (await hostLogs(page, 'save-items')).at(-1).text;
  await expect.poll(lastSaved).toBe(`${JSON_NOTE}ABC`);
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

const TWO_REQUESTS = 'GET https://a.example\n\n### B\nGET https://b.example\n';

test.describe('narrow screens', () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });

  test('stack the editor above the requests at full width', async ({ page }) => {
    const plugin = await openHost(page, { text: TWO_REQUESTS });
    await expect(plugin.locator('.block')).toHaveCount(2);

    const editor = await plugin.locator('.raw-editor-container').boundingBox();
    const list = await plugin.locator('.requests-list').boundingBox();

    expect(editor.width).toBeGreaterThan(350);
    expect(list.width).toBeGreaterThan(350);
    expect(editor.height).toBeGreaterThan(200);
    expect(list.height).toBeGreaterThan(200);
    expect(list.y).toBeGreaterThanOrEqual(editor.y + editor.height - 2);
    await expect(plugin.locator('.divider')).toBeHidden();
  });
});

test.describe('wide screens', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('keep the editor and the requests side by side', async ({ page }) => {
    const plugin = await openHost(page, { text: TWO_REQUESTS });
    await expect(plugin.locator('.block')).toHaveCount(2);

    const editor = await plugin.locator('.raw-editor-container').boundingBox();
    const list = await plugin.locator('.requests-list').boundingBox();

    expect(list.x).toBeGreaterThanOrEqual(editor.x + editor.width - 2);
    expect(Math.abs(list.y - editor.y)).toBeLessThan(2);
  });
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
