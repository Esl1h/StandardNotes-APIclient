import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeRequest, isBinaryContentType } from './executor';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

// jsdom's Blob has no stream(), so build the body stream by hand.
function streamOf(data: string | ArrayBuffer): ReadableStream<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function makeResponse(
  body: string,
  status: number,
  headers: Array<[string, string]> = [],
  url = ''
) {
  const headerMap = new Map(headers);
  return {
    status,
    url,
    text: async () => body,
    body: streamOf(body),
    headers: {
      forEach: (callback: (value: string, name: string) => void) =>
        headerMap.forEach((value, name) => callback(value, name)),
    },
  };
}

describe('isBinaryContentType', () => {
  it.each([
    ['image/png', true],
    ['IMAGE/PNG', true],
    ['image/jpeg; charset=binary', true],
    ['application/pdf', true],
    ['application/octet-stream', true],
    ['application/zip', true],
    ['audio/mpeg', true],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', true],
    ['application/json', false],
    ['application/vnd.api+json', false],
    ['text/plain; charset=utf-8', false],
    ['text/html', false],
    ['image/svg+xml', false],
    ['application/pdfx', false],
    ['image/', false],
    ['image/png<x>', false],
    ['application/vnd.ms-', false],
    ['', false],
  ])('classifies %j as binary: %s', (contentType, expected) => {
    expect(isBinaryContentType(contentType)).toBe(expected);
  });
});

describe('executeRequest', () => {
  it('returns status, time, size, headers and body on success', async () => {
    fetchMock.mockResolvedValue(
      makeResponse('{"ok": true}', 200, [['content-type', 'application/json']])
    );

    const { response, error } = await executeRequest({
      method: 'GET',
      url: 'https://example.com/ok',
      headers: {},
    });

    expect(error).toBeUndefined();
    expect(response?.status).toBe(200);
    expect(response?.headers).toEqual({ 'content-type': 'application/json' });
    expect(response?.body).toBe('{"ok": true}');
    expect(response?.sizeBytes).toBe(12);
    expect(response?.timeMs).toBeGreaterThanOrEqual(0);
  });

  it('reports the final URL when the request was redirected', async () => {
    fetchMock.mockResolvedValue(makeResponse('ok', 200, [], 'https://example.com/final.html'));

    const { response } = await executeRequest({
      method: 'GET',
      url: 'https://example.com/start',
      headers: {},
    });

    expect(response?.redirectedTo).toBe('https://example.com/final.html');
  });

  it('omits the final URL when nothing redirected', async () => {
    fetchMock.mockResolvedValue(makeResponse('ok', 200, [], 'https://example.com/ok'));

    const { response } = await executeRequest({
      method: 'GET',
      url: 'https://example.com/ok',
      headers: {},
    });

    expect(response?.redirectedTo).toBeUndefined();
  });

  it.each(['GET', 'HEAD', 'get'])('never sends a body with %s', async (method) => {
    fetchMock.mockResolvedValue(makeResponse('ok', 200));

    await executeRequest({
      method,
      url: 'https://example.com/ok',
      headers: {},
      body: '',
    });

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('reports the content-length as the size when the server sends one', async () => {
    fetchMock.mockResolvedValue(makeResponse('{"ok": true}', 200, [['content-length', '5000']]));

    const { response } = await executeRequest({ method: 'GET', url: 'https://x.y', headers: {} });

    expect(response?.sizeBytes).toBe(5000);
    expect(response?.sizeIsDecoded).toBe(false);
  });

  it.each([[[]], [[['content-length', 'abc']]]])(
    'falls back to the decoded size without a usable content-length (%j)',
    async (headers) => {
      fetchMock.mockResolvedValue(makeResponse('héllo', 200, headers as Array<[string, string]>));

      const { response } = await executeRequest({ method: 'GET', url: 'https://x.y', headers: {} });

      // Bytes of the decoded text, not characters.
      expect(response?.sizeBytes).toBe(6);
      expect(response?.sizeIsDecoded).toBe(true);
    }
  );

  it('keeps a binary response as a blob instead of decoding it as text', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
    const text = vi.fn();
    fetchMock.mockResolvedValue({
      status: 200,
      text,
      body: streamOf(bytes),
      arrayBuffer: async () => bytes,
      headers: {
        forEach: (callback: (value: string, name: string) => void) =>
          callback('IMAGE/PNG; q=1', 'content-type'),
      },
    });

    const { response } = await executeRequest({
      method: 'GET',
      url: 'https://x.y/a.png',
      headers: {},
    });

    expect(text).not.toHaveBeenCalled();
    expect(response?.body).toBe('');
    expect(response?.binary?.contentType).toBe('image/png');
    expect(response?.binary?.blob.size).toBe(4);
    expect(response?.binary?.blob.type).toBe('image/png');
    expect(response?.sizeBytes).toBe(4);
    expect(response?.sizeIsDecoded).toBe(true);
  });

  it('sends method, headers and body through fetch', async () => {
    fetchMock.mockResolvedValue(makeResponse('created', 201));

    await executeRequest({
      method: 'POST',
      url: 'https://example.com/items',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a": 1}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"a": 1}',
      })
    );
  });

  it('reports network errors', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));

    const { response, error } = await executeRequest(
      { method: 'GET', url: 'https://example.com/fail', headers: {} },
      { timeoutMs: 1000 }
    );

    expect(response).toBeUndefined();
    expect(error?.kind).toBe('network');
    expect(error?.message).toBe('boom');
  });

  it.each([
    ['Chromium', 'Failed to fetch'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
    ['Safari', 'Load failed'],
  ])('hints at CORS when %s reports a failed fetch', async (_browser, message) => {
    fetchMock.mockRejectedValue(new TypeError(message));

    const { error } = await executeRequest({
      method: 'GET',
      url: 'https://example.com/blocked',
      headers: {},
    });

    expect(error?.message).toBe(message);
    expect(error?.hint).toMatch(/CORS/);
    expect(error?.hint).toMatch(/Access-Control-Allow-Origin/);
  });

  it('gives no CORS hint for other failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to parse URL from nope'));
    const parse = await executeRequest({ method: 'GET', url: 'nope', headers: {} });

    fetchMock.mockRejectedValue(new Error('boom'));
    const other = await executeRequest({ method: 'GET', url: 'https://x.y', headers: {} });

    expect(parse.error?.hint).toBeUndefined();
    expect(other.error?.hint).toBeUndefined();
  });

  it('reports timeouts', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        })
    );

    const { error } = await executeRequest(
      { method: 'GET', url: 'https://example.com/slow', headers: {} },
      { timeoutMs: 30 }
    );

    expect(error?.kind).toBe('timeout');
  });

  it('reports user cancellation', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        })
    );

    const controller = new AbortController();
    const pending = executeRequest(
      { method: 'GET', url: 'https://example/long', headers: {} },
      { signal: controller.signal, timeoutMs: 1000 }
    );
    controller.abort();
    const { response, error } = await pending;

    expect(response).toBeUndefined();
    expect(error?.kind).toBe('aborted');
  });
  it('clamps a timeout above the timer limit so the request is not aborted at once', async () => {
    fetchMock.mockImplementation(async (_url: string, init: { signal: AbortSignal }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(init.signal.aborted).toBe(false);
      return makeResponse('ok', 200);
    });

    const { response, error } = await executeRequest(
      { method: 'GET', url: 'https://x.y', headers: {} },
      { timeoutMs: 3_000_000_000 }
    );

    expect(error).toBeUndefined();
    expect(response?.status).toBe(200);
  });

  it('refuses a response body above the size cap', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent++;
        controller.enqueue(chunk);
      },
      cancel,
    });
    fetchMock.mockResolvedValue({
      ...makeResponse('', 200, [['content-type', 'text/plain']]),
      body: stream,
    });

    const { response, error } = await executeRequest({
      method: 'GET',
      url: 'https://x.y/huge',
      headers: {},
    });

    expect(response).toBeUndefined();
    expect(error?.message).toMatch(/response too large/i);
    expect(cancel).toHaveBeenCalled();
    expect(sent).toBeLessThan(40);
  });

  it('refuses an oversized binary body too', async () => {
    const stream = streamOf(new ArrayBuffer(26 * 1024 * 1024));
    fetchMock.mockResolvedValue({
      ...makeResponse('', 200, [['content-type', 'image/png']]),
      body: stream,
    });

    const { error } = await executeRequest({
      method: 'GET',
      url: 'https://x.y/a.png',
      headers: {},
    });

    expect(error?.message).toMatch(/response too large/i);
  });

  it('decodes a multi-byte character split across chunks', async () => {
    const bytes = new TextEncoder().encode('é');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    });
    fetchMock.mockResolvedValue({ ...makeResponse('', 200), body: stream });

    const { response } = await executeRequest({ method: 'GET', url: 'https://x.y', headers: {} });

    expect(response?.body).toBe('é');
  });

  it('asks fetch not to cache the response nor send a referrer', async () => {
    fetchMock.mockResolvedValue(makeResponse('', 200));

    await executeRequest({ method: 'GET', url: 'https://x.y', headers: {} });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  });

  it('cancels at once when the signal is already aborted', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (init.signal.aborted) {
            reject(new Error('AbortError'));
          }
        })
    );

    const { error } = await executeRequest(
      { method: 'GET', url: 'https://x.y', headers: {} },
      { signal: AbortSignal.abort(), timeoutMs: 1000 }
    );

    expect(error?.kind).toBe('aborted');
  });
});
