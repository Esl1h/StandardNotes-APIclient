/** How long a copy button shows the outcome before its label returns. */
const COPY_FEEDBACK_MS = 1500;

/**
 * Copies a hidden selection, the way pages did before the async API.
 * Chromium (Brave, the Electron desktop app) refuses navigator.clipboard
 * in the plugin's iframe, which the host loads cross-origin without
 * allow="clipboard-write"; that policy does not cover this path, which
 * only needs the click that triggered it.
 */
function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  const focused = document.activeElement;
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    if (focused instanceof HTMLElement) {
      focused.focus();
    }
  }
}

/**
 * Writes `text` to the clipboard. False when neither the async clipboard
 * nor the selection fallback could write it, so the button can say so
 * instead of failing silently.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithSelection(text);
  }
}

export { COPY_FEEDBACK_MS, copyText };
