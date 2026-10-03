import type { HTTPError, HTTPResponse } from './types';

const CORS_HINT =
  'Probable CORS block: the API must answer with an Access-Control-Allow-Origin header that allows this page.';

// A blocked or unreachable fetch is a bare TypeError, worded per browser.
const FAILED_FETCH =
  /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i;

// Content types whose bytes are not text. Anything unknown is read as text,
// which is what the block can display; svg is text and stays on that side.
const BINARY_CONTENT_TYPE =
  /^(?:(?:image|audio|video|font)\/|application\/(?:pdf|octet-stream|zip|gzip|x-gzip|x-tar|x-7z-compressed|x-rar-compressed|msword|wasm|vnd\.(?:ms-|openxmlformats-)))/;

/** True when a Content-Type header describes a response that is not text */
function isBinaryContentType(contentType: string): boolean {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return mime !== 'image/svg+xml' && BINARY_CONTENT_TYPE.test(mime);
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
  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Link an external signal (e.g. user cancel) with our timeout.
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

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
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });

    let text = '';
    let binary: HTTPResponse['binary'];
    let decodedSize: number;
    if (isBinaryContentType(headers['content-type'] ?? '')) {
      const buffer = await response.arrayBuffer();
      const contentType = headers['content-type'].split(';')[0].trim();
      binary = { blob: new Blob([buffer], { type: contentType }), contentType };
      decodedSize = buffer.byteLength;
    } else {
      text = await response.text();
      decodedSize = new TextEncoder().encode(text).length;
    }

    // content-length is the size on the wire; the decoded text is only the
    // fallback, and says so, since compression makes the two differ.
    const contentLength = Number(headers['content-length']);
    const hasContentLength = headers['content-length'] !== undefined && Number.isFinite(contentLength);

    return {
      response: {
        status: response.status,
        timeMs: Math.round(performance.now() - startedAt),
        sizeBytes: hasContentLength ? contentLength : decodedSize,
        sizeIsDecoded: !hasContentLength,
        headers,
        body: text,
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
