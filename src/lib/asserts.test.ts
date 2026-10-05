import { describe, expect, it } from 'vitest';
import { evaluateAssert } from './asserts';
import { type HTTPResponse } from './types';

const response: HTTPResponse = {
  status: 200,
  timeMs: 5,
  sizeBytes: 10,
  sizeIsDecoded: true,
  headers: { 'Content-Type': 'application/json', 'X-Token': 'abc' },
  body: JSON.stringify({ id: 7, name: 'John', empty: null, items: [1, 2] }),
};

describe('evaluateAssert', () => {
  it('compares the status numerically', () => {
    expect(evaluateAssert('status == 200', response)).toBe(true);
    expect(evaluateAssert('status != 200', response)).toBe(false);
    expect(evaluateAssert('status == 404', response)).toBe(false);
    expect(evaluateAssert('status >= 200', response)).toBe(true);
    expect(evaluateAssert('status < 300', response)).toBe(true);
    expect(evaluateAssert('status > 200', response)).toBe(false);
    expect(evaluateAssert('status <= 200', response)).toBe(true);
  });

  it('compares a body path as text or number', () => {
    expect(evaluateAssert('body.$.name == John', response)).toBe(true);
    expect(evaluateAssert('body.$.name == "John"', response)).toBe(true);
    expect(evaluateAssert("body.$.name == 'John'", response)).toBe(true);
    expect(evaluateAssert('body.$.id == 7', response)).toBe(true);
    expect(evaluateAssert('body.$.id != 7', response)).toBe(false);
    expect(evaluateAssert('body.$.items[0] == 1', response)).toBe(true);
  });

  it('compares headers case-insensitively', () => {
    expect(evaluateAssert('headers.x-token == abc', response)).toBe(true);
    expect(evaluateAssert('headers.X-Token == abc', response)).toBe(true);
    expect(evaluateAssert('headers.x-token != abc', response)).toBe(false);
    expect(evaluateAssert('headers.missing == abc', response)).toBe(false);
  });

  it('checks existence', () => {
    expect(evaluateAssert('body.$.id exists', response)).toBe(true);
    expect(evaluateAssert('body.$.missing exists', response)).toBe(false);
    expect(evaluateAssert('body.$.missing not exists', response)).toBe(true);
    expect(evaluateAssert('headers.x-token exists', response)).toBe(true);
    expect(evaluateAssert('headers.missing exists', response)).toBe(false);
  });

  it('compares the whole body as text', () => {
    expect(evaluateAssert(`body == ${response.body}`, response)).toBe(true);
    expect(evaluateAssert('body == nope', response)).toBe(false);
  });

  it('fails when the body is not JSON', () => {
    const plain = { ...response, body: 'not json' };

    expect(evaluateAssert('body.$.id == 7', plain)).toBe(false);
    expect(evaluateAssert('body.$.id exists', plain)).toBe(false);
  });

  it('returns null for malformed assertions', () => {
    expect(evaluateAssert('nonsense == 1', response)).toBeNull();
    expect(evaluateAssert('status =', response)).toBeNull();
    expect(evaluateAssert('status', response)).toBeNull();
    expect(evaluateAssert('body.$.name == ', response)).toBeNull();
  });
});
