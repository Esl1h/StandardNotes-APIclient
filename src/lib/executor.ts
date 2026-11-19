import type { HTTPError, HTTPResponse } from './types';

const CORS_HINT =
  'Probable CORS block: the API must answer with an Access-Control-Allow-Origin header that allows this page.';

// A blocked or unreachable fetch is a bare TypeError, worded per browser.
const FAILED_FETCH =
  /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i;

// Content types whose bytes are not text. Anything unknown is read as text,
// which is what the block can display; svg is text and stays on that side.
// Anchored at both ends: the matched type becomes the Blob type behind the
// preview and the download link, so it must be exactly one of these.
const BINARY_CONTENT_TYPE =
  /^(?:(?:image|audio|video|font)\/[\w.+-]+|application\/(?:pdf|octet-stream|zip|gzip|x-gzip|x-tar|x-7z-compressed|x-rar-compressed|msword|wasm|vnd\.(?:ms-|openxmlformats-)[\w.+-]+))$/;

/** True when a Content-Type header describes a response that is not text */
function isBinaryContentType(contentType: string): boolean {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return mime !== 'image/svg+xml' && BINARY_CONTENT_TYPE.test(mime);
}

// setTimeout stores its delay as a 32-bit signed integer; a larger one fires
// at once, which would abort a request the user gave a very long timeout.
const MAX_TIMER_MS = 2_147_483_647;
// The whole body is held in memory and then in the note's editor state, so an
// endless or huge response must fail instead of freezing the tab.
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

class ResponseTooLarge extends Error {
  constructor() {
    super(`Response too large (over ${MAX_RESPONSE_BYTES / 1024 / 1024} MB)`);
  }
}

/** Reads the body through the stream so the cap holds before it is all in memory */
async function readCapped(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) {
    return new Uint8Array();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.length;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ResponseTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

interface ExecuteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ExecutionResult {
  response?: HTTPResponse;
  error?: HTTPError;
}

/**
 * Executes a single parsed HTTP request in the browser. Response metadata
 * (status, time, size, headers, body) stays in memory; persistence is the
 * note text's responsibility.
 */
async function executeRequest(
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  },
  options: ExecuteOptions = {}
): Promise<ExecutionResult> {
  const timeoutMs = Math.min(options.timeoutMs ?? 30000, MAX_TIMER_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Link an external signal (e.g. user cancel) with our timeout.
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });
  // An abort that fired before the listener existed would never be seen.
  if (options.signal?.aborted) {
    controller.abort();
  }

  const startedAt = performance.now();
  // fetch throws on a body with GET/HEAD; sending none beats failing the run.
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : request.body;

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body,
      signal: controller.signal,
      // Responses can carry secrets and the note's origin is not the API's
      // business: no HTTP cache reuse, no Referer header.
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });

    let text = '';
    let binary: HTTPResponse['binary'];
    let decodedSize: number;
    if (isBinaryContentType(headers['content-type'] ?? '')) {
      const bytes = await readCapped(response);
      const contentType = headers['content-type'].split(';')[0].trim().toLowerCase();
      binary = { blob: new Blob([bytes], { type: contentType }), contentType };
      decodedSize = bytes.byteLength;
    } else {
      const bytes = await readCapped(response);
      text = new TextDecoder().decode(bytes);
      decodedSize = bytes.byteLength;
    }

    // content-length is the size on the wire; the decoded text is only the
    // fallback, and says so, since compression makes the two differ.
    const contentLength = Number(headers['content-length']);
    const hasContentLength =
      headers['content-length'] !== undefined && Number.isFinite(contentLength);

    // fetch follows redirects silently; surface where it ended up, since a
    // 200 from the wrong endpoint is a classic debugging dead end.
    const redirectedTo = response.url && response.url !== request.url ? response.url : undefined;

    return {
      response: {
        status: response.status,
        timeMs: Math.round(performance.now() - startedAt),
        sizeBytes: hasContentLength ? contentLength : decodedSize,
        sizeIsDecoded: !hasContentLength,
        headers,
        body: text,
        ...(redirectedTo && { redirectedTo }),
        ...(binary && { binary }),
      },
    };
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      return {
        error: {
          kind: 'timeout',
          message: `Request timed out after ${timeoutMs} ms`,
        },
      };
    }
    if (options.signal?.aborted) {
      return { error: { kind: 'aborted', message: 'Request cancelled' } };
    }
    const message = error instanceof Error ? error.message : 'Network error';
    const probablyCors = error instanceof TypeError && FAILED_FETCH.test(message);
    return {
      error: {
        kind: 'network',
        message,
        ...(probablyCors && { hint: CORS_HINT }),
      },
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export type { ExecuteOptions, ExecutionResult };
export { executeRequest, isBinaryContentType };
