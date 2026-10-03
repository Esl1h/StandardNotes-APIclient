/**
 * Request headers that browsers refuse to set from script (Fetch spec,
 * "forbidden request-header name"). fetch drops them without any error, so
 * a request that declares one looks fine but never sends it.
 */
const FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'set-cookie',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
]);

/** Names, as declared, of the headers in the request the browser will drop. */
function findIgnoredHeaders(headers: Record<string, string>): string[] {
  return Object.keys(headers).filter((name) => {
    const lowerName = name.toLowerCase();
    return (
      FORBIDDEN_HEADERS.has(lowerName) ||
      lowerName.startsWith('proxy-') ||
      lowerName.startsWith('sec-')
    );
  });
}

export { findIgnoredHeaders };
