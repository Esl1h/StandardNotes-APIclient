import { describe, expect, it } from 'vitest';
import { prettyPrintBody } from './prettyPrint';

describe('prettyPrintBody', () => {
  it('formats JSON objects with 2 space indent', () => {
    expect(prettyPrintBody('{"a":1,"b":[2,3]}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}'
    );
  });

  it('formats JSON arrays', () => {
    expect(prettyPrintBody('[1,2]')).toBe('[\n  1,\n  2\n]');
  });

  it('leaves plain text bodies untouched', () => {
    expect(prettyPrintBody('zen mode')).toBeNull();
  });

  it('leaves html bodies untouched', () => {
    expect(prettyPrintBody('<html></html>')).toBeNull();
  });

  it('tolerates empty bodies', () => {
    expect(prettyPrintBody('')).toBeNull();
  });

  it('rejects malformed JSON that starts like JSON', () => {
    expect(prettyPrintBody('{"broken":')).toBeNull();
  });

  it('handles bodies with leading whitespace', () => {
    expect(prettyPrintBody('\n  {"a": 1}\n')).toBe('{\n  "a": 1\n}');
  });
});
