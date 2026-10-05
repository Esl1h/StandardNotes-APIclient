/**
 * Renders a parsed request as a cURL command, quoting every value with
 * single quotes and escaping inner ones, so the output can be pasted into a
 * shell to reproduce (and debug) the request outside Standard Notes.
 */

import { type HttpRequest } from './parser';

/** A single-quoted shell argument with any inner quote escaped. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The request as a `curl` command line. */
function toCurl(request: HttpRequest): string {
  const parts = ['curl', '-X', request.method.toUpperCase(), shellQuote(request.url)];
  for (const [name, value] of Object.entries(request.headers)) {
    parts.push('-H', shellQuote(`${name}: ${value}`));
  }
  if (request.body !== undefined) {
    parts.push('--data-raw', shellQuote(request.body));
  }
  return parts.join(' ');
}

export { toCurl };
