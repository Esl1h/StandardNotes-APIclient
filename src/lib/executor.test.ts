import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeRequest } from './executor';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function makeResponse(
  body: string,
  status: number,
  headers: Array<[string, string]> = []
) {
  const headerMap = new Map(headers);
  return {
    status,
    text: async () => body,
    headers: {
      forEach: (callback: (value: string, name: string) => void) =>
        headerMap.forEach((value, name) => callback(value, name)),
    },
  };
}

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

  it('reports timeouts', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('AbortError'))
          );
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
          init.signal.addEventListener('abort', () =>
            reject(new Error('AbortError'))
          );
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
});
