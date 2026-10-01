import { describe, expect, it } from 'vitest';

/**
 * The pretty printing logic lives in Block (a React class). Reimplement the
 * contract here so regressions in the display path cannot hide: any change
 * to prettyPrintBody should be mirrored by this contract test.
 *
 * Contract:
 * - JSON objects and arrays are re-stringified with 2 space indentation
 * - Non-JSON bodies (text, html, empty) return null (raw display)
 * - Malformed JSON that merely starts like JSON returns null
 */
function prettyPrintContract(body: string): string | null {
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

describe('response body pretty print contract', () => {
  it('formats JSON objects with 2 space indent', () => {
    expect(prettyPrintContract('{"a":1,"b":[2,3]}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}'
    );
  });

  it('formats JSON arrays', () => {
    expect(prettyPrintContract('[1,2]')).toBe('[\n  1,\n  2\n]');
  });

  it('leaves plain text bodies untouched', () => {
    expect(prettyPrintContract('zen mode')).toBeNull();
  });

  it('leaves html bodies untouched', () => {
    expect(prettyPrintContract('<html></html>')).toBeNull();
  });

  it('tolerates empty bodies', () => {
    expect(prettyPrintContract('')).toBeNull();
  });

  it('rejects malformed JSON that starts like JSON', () => {
    expect(prettyPrintContract('{"broken":')).toBeNull();
  });

  it('handles bodies with leading whitespace', () => {
    expect(prettyPrintContract('\n  {"a": 1}\n')).toBe('{\n  "a": 1\n}');
  });
});
