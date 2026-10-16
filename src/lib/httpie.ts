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
  const method = request.method.toUpperCase();
  const items = [shellQuote(request.url)];
  for (const [name, value] of Object.entries(request.headers)) {
    items.push(shellQuote(`${name}: ${value}`));
  }
  const raw = request.body !== undefined ? ['--raw', shellQuote(request.body)] : [];
  // Quoting does not stop HTTPie from reading a url that starts with "-" as
  // an option; "--" ends the options, so --raw has to come before it.
  if (request.url.startsWith('-')) {
    return ['http', ...raw, '--', method, ...items].join(' ');
  }
  return ['http', method, ...items, ...raw].join(' ');
}

export { toHttpie, shellQuote };
