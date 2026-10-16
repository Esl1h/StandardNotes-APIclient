/** How long a copy button shows the outcome before its label returns. */
const COPY_FEEDBACK_MS = 1500;

/**
 * Writes `text` to the clipboard. False when the frame has no clipboard
 * access (an insecure or sandboxed context leaves navigator.clipboard
 * undefined) or the browser refuses the write, so the button can say so
 * instead of failing silently.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export { COPY_FEEDBACK_MS, copyText };
