import type { HTTPError, HTTPResponse } from './types';

const CORS_HINT =
  'Probable CORS block: the API must answer with an Access-Control-Allow-Origin header that allows this page.';

// A blocked or unreachable fetch is a bare TypeError, worded per browser.
const FAILED_FETCH =
  /^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i;

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

    const text = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });

    // content-length is the size on the wire; the decoded text is only the
    // fallback, and says so, since compression makes the two differ.
    const contentLength = Number(headers['content-length']);
    const hasContentLength = headers['content-length'] !== undefined && Number.isFinite(contentLength);

    return {
      response: {
        status: response.status,
        timeMs: Math.round(performance.now() - startedAt),
        sizeBytes: hasContentLength ? contentLength : new TextEncoder().encode(text).length,
        sizeIsDecoded: !hasContentLength,
        headers,
        body: text,
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
export { executeRequest };
