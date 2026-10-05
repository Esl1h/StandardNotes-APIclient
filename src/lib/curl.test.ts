import { describe, expect, it } from 'vitest';
import { toCurl } from './curl';
import { type HttpRequest } from './parser';

const request = (overrides: Partial<HttpRequest>): HttpRequest => ({
  title: 'T',
  method: 'GET',
  url: 'https://example.com/a',
  headers: {},
  lineIndex: 0,
  ...overrides,
});

describe('toCurl', () => {
  it('builds a plain GET', () => {
    expect(toCurl(request({}))).toBe("curl -X GET 'https://example.com/a'");
  });

  it('keeps the method and the query string', () => {
    expect(toCurl(request({ method: 'DELETE', url: 'https://example.com/a?x=1' }))).toBe(
      "curl -X DELETE 'https://example.com/a?x=1'"
    );
  });

  it('adds one -H flag per header, preserving the original case', () => {
    const curl = toCurl(
      request({
        headers: { 'Content-Type': 'application/json', 'x-a': '1' },
      })
    );

    expect(curl).toBe(
      "curl -X GET 'https://example.com/a' -H 'Content-Type: application/json' -H 'x-a: 1'"
    );
  });

  it('adds the body with --data-raw', () => {
    const curl = toCurl(request({ method: 'POST', body: '{"a": 1}' }));

    expect(curl).toBe("curl -X POST 'https://example.com/a' --data-raw '{\"a\": 1}'");
  });

  it('escapes single quotes in any part', () => {
    const curl = toCurl(
      request({
        url: "https://example.com/a'b",
        headers: { 'X-Q': "it's" },
        body: "it's",
      })
    );

    expect(curl).toBe(
      "curl -X GET 'https://example.com/a'\\''b' -H 'X-Q: it'\\''s' --data-raw 'it'\\''s'"
    );
  });
});
