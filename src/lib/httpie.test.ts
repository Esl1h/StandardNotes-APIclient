import { describe, expect, it } from 'vitest';
import { shellQuote, toHttpie } from './httpie';
import { type HttpRequest } from './parser';

const request = (overrides: Partial<HttpRequest>): HttpRequest => ({
  title: 'A',
  method: 'GET',
  url: 'https://x.y/a',
  headers: {},
  lineIndex: 0,
  ...overrides,
});

describe('shellQuote', () => {
  it('single quotes a value', () => {
    expect(shellQuote('abc')).toBe("'abc'");
  });

  it('escapes inner single quotes', () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

describe('toHttpie', () => {
  it('renders a bare GET', () => {
    expect(toHttpie(request({}))).toBe("http GET 'https://x.y/a'");
  });

  it('renders headers as quoted header items', () => {
    expect(
      toHttpie(
        request({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: "Bearer 'tok'" },
        })
      )
    ).toBe(
      "http POST 'https://x.y/a' 'Content-Type: application/json' 'Authorization: Bearer '\\''tok'\\'''"
    );
  });

  it('renders a body with --raw', () => {
    expect(
      toHttpie(request({ method: 'PUT', body: '{"a": 1}' }))
    ).toBe("http PUT 'https://x.y/a' --raw '{\"a\": 1}'");
  });

  it('uppercases whatever method was parsed', () => {
    expect(toHttpie(request({ method: 'patch' }))).toBe("http PATCH 'https://x.y/a'");
  });
});
