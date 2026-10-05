/**
 * kulala-style assertions, written as `# @assert <lhs> <op> <rhs>` comment
 * lines inside a request block and evaluated against its response at run
 * time. LHS: `status`, `headers.<name>`, `body` or `body.$.path` (the same
 * JSONPath subset used by chaining). Operators: `==`, `!=`, `>`, `<`, `>=`,
 * `<=`, `exists` and `not exists`. Malformed assertions are reported as
 * failing, so a typo never passes silently.
 */

import { bodyPath, headerValue } from './chaining';
import { type HTTPResponse } from './types';

const EXISTS = /^(.+?)\s+(not\s+)?exists$/;
const COMPARE = /^(.+?)\s*(===|==|!=|>=|<=|>|<)\s*(.+)$/;

/** True for the left-hand sides an assertion can read. */
function isReadableLhs(text: string): boolean {
  return (
    text === 'status' || text === 'body' || text.startsWith('body.$') || text.startsWith('headers.')
  );
}

/** Reads the left-hand side; undefined when the response has no such value. */
function readLhs(lhs: string, response: HTTPResponse): string | number | undefined {
  if (lhs === 'status') {
    return response.status;
  }
  if (lhs === 'body') {
    return response.body;
  }
  if (lhs.startsWith('body.$')) {
    return bodyPath(response, lhs.slice('body.'.length));
  }
  return headerValue(response, lhs.slice('headers.'.length));
}

function compare(
  actual: string | number | undefined,
  op: '==' | '!=' | '>' | '<' | '>=' | '<=',
  expected: string
): boolean {
  if (actual === undefined) {
    return false;
  }
  const actualNumber = typeof actual === 'number' ? actual : Number(actual);
  const expectedNumber = Number(expected);
  // Numeric comparison when both sides are numbers (status, ids, counts);
  // text comparison otherwise, so names and tokens are not coerced.
  const numeric =
    (typeof actual === 'number' || actual.trim() !== '') && Number.isFinite(expectedNumber);
  const [left, right] = numeric
    ? [actualNumber, expectedNumber]
    : [String(actual).trim(), expected.trim()];
  switch (op) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
  }
}

/**
 * Evaluates one assertion source against a response; null when the source
 * is malformed (unparseable left-hand side or missing operands).
 */
function evaluateAssert(source: string, response: HTTPResponse): boolean | null {
  const text = source.trim();
  if (text === '') {
    return null;
  }
  const existsMatch = text.match(EXISTS);
  if (existsMatch) {
    const lhs = existsMatch[1].trim();
    if (!isReadableLhs(lhs)) {
      return null;
    }
    const exists = readLhs(lhs, response) !== undefined;
    return existsMatch[2] ? !exists : exists;
  }
  const compareMatch = text.match(COMPARE);
  if (!compareMatch) {
    return null;
  }
  const lhs = compareMatch[1].trim();
  if (!isReadableLhs(lhs)) {
    return null;
  }
  const op = (compareMatch[2] === '===' ? '==' : compareMatch[2]) as
    '==' | '!=' | '>' | '<' | '>=' | '<=';
  const expected = compareMatch[3].trim().replace(/^["']|["']$/g, '');
  return compare(readLhs(lhs, response), op, expected);
}

export { evaluateAssert };
