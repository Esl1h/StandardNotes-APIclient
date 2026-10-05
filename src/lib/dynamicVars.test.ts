import { describe, expect, it } from 'vitest';
import { applyDynamicVariables, resolveDynamicRequest } from './dynamicVars';
import { type HttpRequest } from './parser';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('applyDynamicVariables', () => {
  it('generates a fresh uuid on every call', () => {
    const first = applyDynamicVariables('{{$uuid}}');
    const second = applyDynamicVariables('{{$uuid}}');

    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(second).not.toBe(first);
  });

  it('generates the unix timestamp in seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const value = Number(applyDynamicVariables('{{$timestamp}}'));
    const after = Math.floor(Date.now() / 1000);

    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });

  it('generates random integers inside the inclusive range', () => {
    for (let i = 0; i < 50; i++) {
      const value = Number(applyDynamicVariables('{{$randomInt 1 5}}'));

      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('generates an iso8601 datetime by default and on request', () => {
    expect(Number.isNaN(Date.parse(applyDynamicVariables('{{$datetime}}')))).toBe(false);
    expect(Number.isNaN(Date.parse(applyDynamicVariables('{{$datetime iso8601}}')))).toBe(false);
  });

  it('generates an rfc1123 datetime on request', () => {
    expect(Number.isNaN(Date.parse(applyDynamicVariables('{{$datetime rfc1123}}')))).toBe(false);
  });

  it('keeps an unknown generator literal', () => {
    expect(applyDynamicVariables('{{$nope}}')).toBe('{{$nope}}');
  });

  it('keeps a malformed generator literal', () => {
    expect(applyDynamicVariables('{{$randomInt 1}}')).toBe('{{$randomInt 1}}');
    expect(applyDynamicVariables('{{$randomInt a b}}')).toBe('{{$randomInt a b}}');
  });

  it('resolves inside surrounding text and several at once', () => {
    const result = applyDynamicVariables('x={{$uuid}}&n={{$randomInt 1 1}}');

    expect(result).toMatch(/^x=[0-9a-f-]{36}&n=1$/);
  });
});

describe('resolveDynamicRequest', () => {
  const request: HttpRequest = {
    title: 'Dyn',
    method: 'POST',
    url: 'https://example.com/{{$randomInt 1 1}}',
    headers: { 'X-Id': '{{$uuid}}' },
    body: '{"t": "{{$timestamp}}"}',
    lineIndex: 0,
  };

  it('resolves url, headers and body copies without mutating the original', () => {
    const resolved = resolveDynamicRequest(request);

    expect(resolved.url).toBe('https://example.com/1');
    expect(resolved.headers['X-Id']).toMatch(UUID);
    expect(resolved.body).toMatch(/^\{"t": "\d+"\}$/);
    expect(request.url).toBe('https://example.com/{{$randomInt 1 1}}');
    expect(request.body).toBe('{"t": "{{$timestamp}}"}');
  });
});
