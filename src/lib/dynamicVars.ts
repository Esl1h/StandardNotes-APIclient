/**
 * Dynamic variables (VS Code REST Client compatible): `{{$uuid}}`,
 * `{{$timestamp}}` (unix seconds), `{{$randomInt min max}}` (inclusive) and
 * `{{$datetime [iso8601|rfc1123]}}`. They are generated at run time, on every
 * execution, so the parsed request and the block preview keep the literal
 * `{{$uuid}}` text; unknown or malformed generators stay literal too.
 */

import { type HttpRequest } from './parser';

const DYNAMIC_REF = /\{\{\s*\$(\w+)((?:\s+[^\s}]+)*)\s*\}\}/g;

/** A random uuid, without depending on crypto.randomUUID availability. */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = (Math.random() * 16) | 0;
    const digit = character === 'x' ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
}

/** One dynamic variable: the generator output, or undefined to stay literal. */
function generate(name: string, args: string[]): string | undefined {
  switch (name) {
    case 'uuid':
      return args.length === 0 ? generateUuid() : undefined;
    case 'timestamp':
      return args.length === 0 ? String(Math.floor(Date.now() / 1000)) : undefined;
    case 'randomInt': {
      const [min, max] = args.map(Number);
      if (args.length !== 2 || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        return undefined;
      }
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    case 'datetime': {
      if (args.length > 1) {
        return undefined;
      }
      const format = args[0] ?? 'iso8601';
      const now = new Date();
      if (format === 'iso8601') {
        return now.toISOString();
      }
      if (format === 'rfc1123') {
        return now.toUTCString();
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Replaces every resolvable dynamic variable in `text`; the rest stay literal. */
function applyDynamicVariables(text: string): string {
  return text.replace(DYNAMIC_REF, (match, name: string, argText: string) => {
    const args = argText.trim() === '' ? [] : argText.trim().split(/\s+/);
    return generate(name, args) ?? match;
  });
}

/** A request copy with every dynamic variable freshly generated. */
function resolveDynamicRequest(request: HttpRequest): HttpRequest {
  const headers: Record<string, string> = {};
  for (const name of Object.keys(request.headers)) {
    headers[name] = applyDynamicVariables(request.headers[name]);
  }
  return {
    ...request,
    url: applyDynamicVariables(request.url),
    headers,
    ...(request.body !== undefined ? { body: applyDynamicVariables(request.body) } : {}),
  };
}

export { applyDynamicVariables, resolveDynamicRequest };
