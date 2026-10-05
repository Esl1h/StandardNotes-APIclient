/**
 * Run-time resolution of chained references: a request labeled with
 * `# @name <label>` records its response here, and later requests resolve
 * `{{label.response.body.$.field}}` and `{{label.response.headers.X}}`
 * against it. The parser leaves these references literal, so each execution
 * resolves from the response that is current at that moment; nothing is ever
 * written back into the note.
 */

import { CHAIN_REF, type HttpRequest } from './parser';
import { type HTTPResponse } from './types';

// The registry lives as long as the editor; responses are volatile by design.
const responses = new Map<string, HTTPResponse>();

/** Records (or overwrites) the response of a labeled request. */
function recordResponse(name: string, response: HTTPResponse): void {
  responses.set(name, response);
}

/** Reads a recorded response, by request label. */
function getResponse(name: string): HTTPResponse | undefined {
  return responses.get(name);
}

/** Drops every recorded response (test isolation). */
function forgetResponses(): void {
  responses.clear();
}

/** Tokens of a JSONPath subset: `$`, `.field`, `[index]` and `[*]`. */
function tokenizePath(path: string): string[] | null {
  const tokens: string[] = [];
  let i = path.startsWith('$') ? 1 : 0;
  while (i < path.length) {
    const character = path[i];
    if (character === '.') {
      i++;
      continue;
    }
    if (character === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) {
        return null;
      }
      tokens.push(path.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== '.' && path[j] !== '[') {
      j++;
    }
    tokens.push(path.slice(i, j));
    i = j;
  }
  return tokens;
}

/** Walks the tokens over `current`; undefined when the path leaves the value. */
function applyTokens(current: unknown, tokens: string[]): unknown {
  if (tokens.length === 0) {
    return current;
  }
  const [head, ...rest] = tokens;
  if (head === '[*]') {
    if (!Array.isArray(current)) {
      return undefined;
    }
    return current
      .map((item) => stringifyValue(applyTokens(item, rest)))
      .filter((value): value is string => value !== undefined)
      .join(',');
  }
  if (head.startsWith('[')) {
    if (!Array.isArray(current)) {
      return undefined;
    }
    return applyTokens(current[Number(head.slice(1, -1))], rest);
  }
  if (current === null || typeof current !== 'object') {
    return undefined;
  }
  return applyTokens((current as Record<string, unknown>)[head], rest);
}

/** Reads `$.a.b[0].c` (a JSONPath subset) from a parsed body. */
function getPath(root: unknown, path: string): unknown {
  const tokens = tokenizePath(path);
  return tokens === null ? undefined : applyTokens(root, tokens);
}

/** A path from a response body as request text; undefined when not JSON or missing. */
function bodyPath(response: HTTPResponse, path: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    return undefined;
  }
  return stringifyValue(getPath(parsed, path));
}

/** A response header value, by any letter case; undefined when absent. */
function headerValue(response: HTTPResponse, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const found = Object.keys(response.headers).find((key) => key.toLowerCase() === wanted);
  return found ? response.headers[found] : undefined;
}

/** A JSONPath value as request text; undefined when the path found nothing. */
function stringifyValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'object') {
    return Array.isArray(value) ? value.map(stringifyValue).join(',') : JSON.stringify(value);
  }
  return String(value);
}

/**
 * Replaces the chaining references in `text` that resolve; the rest stay
 * literal, so the block can still warn about what did not.
 */
function resolveChaining(text: string): string {
  return text.replace(CHAIN_REF, (match, name: string, kind: string, path: string) => {
    const response = responses.get(name);
    if (!response || kind !== 'response') {
      return match;
    }
    if (path === 'body') {
      return response.body;
    }
    if (path.startsWith('body.')) {
      const value = bodyPath(response, path.slice('body.'.length));
      return value === undefined ? match : value;
    }
    if (path.startsWith('headers.')) {
      const value = headerValue(response, path.slice('headers.'.length));
      return value === undefined ? match : value;
    }
    return match;
  });
}

/** A request copy with every resolvable chaining reference substituted. */
function resolveChainedRequest(request: HttpRequest): HttpRequest {
  const url = resolveChaining(request.url);
  const headers: Record<string, string> = {};
  for (const name of Object.keys(request.headers)) {
    headers[name] = resolveChaining(request.headers[name]);
  }
  return {
    ...request,
    url,
    headers,
    ...(request.body !== undefined ? { body: resolveChaining(request.body) } : {}),
  };
}

export {
  recordResponse,
  getResponse,
  forgetResponses,
  resolveChaining,
  resolveChainedRequest,
  bodyPath,
  headerValue,
};
