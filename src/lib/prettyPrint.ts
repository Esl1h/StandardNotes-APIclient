/** Pretty prints JSON bodies for display; copy keeps the raw text */
function prettyPrintBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

export { prettyPrintBody };
