/**
 * Renders a parsed request as an HTTPie command, quoting every value with
 * single quotes and escaping inner ones, so the output can be pasted into a
 * shell to reproduce (and debug) the request outside Standard Notes.
 */

import { type HttpRequest } from './parser';

/** A single-quoted shell argument with any inner quote escaped. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The request as an `http` (HTTPie) command line. */
function toHttpie(request: HttpRequest): string {
  const parts = ['http', request.method.toUpperCase(), shellQuote(request.url)];
  for (const [name, value] of Object.entries(request.headers)) {
    parts.push(shellQuote(`${name}: ${value}`));
  }
  if (request.body !== undefined) {
    parts.push('--raw', shellQuote(request.body));
  }
  return parts.join(' ');
}

export { toHttpie, shellQuote };
