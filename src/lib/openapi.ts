/**
 * Renders the whole .http file as an OpenAPI 3.1 document: one operation
 * per request block, with the query string and headers as parameters and
 * the body as an example under its content type. A url that still holds
 * unresolved {{variables}} (or is not an absolute http(s) url) keeps its
 * raw text as the path, since template braces mean nothing to a URL
 * parser. Two blocks with the same path and method collapse into the last
 * one, the way the file itself redefines them.
 */

import { type HttpFile, type HttpRequest } from './parser';

/** The path part of the request url, or the raw text when it is not one. */
function pathOf(request: HttpRequest): string {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname === '' ? '/' : pathname;
  } catch {
    return request.url;
  }
}

/** The content type of a request body, by any letter case, without
 * parameters such as charset; text/plain when no content-type is set. */
function bodyContentType(request: HttpRequest): string {
  const found = Object.keys(request.headers).find(
    (name) => name.toLowerCase() === 'content-type'
  );
  const value = found === undefined ? undefined : request.headers[found];
  return (value ?? 'text/plain').split(';')[0].trim();
}

/** The OpenAPI operation object of one request block. */
function operation(request: HttpRequest): Record<string, unknown> {
  const parameters: Array<Record<string, unknown>> = [];
  try {
    for (const name of new Set(new URL(request.url).searchParams.keys())) {
      parameters.push({ name, in: 'query', schema: { type: 'string' } });
    }
  } catch {
    // Not a parsable url: no query parameters to list.
  }
  for (const name of Object.keys(request.headers)) {
    parameters.push({ name, in: 'header', schema: { type: 'string' } });
  }

  const item: Record<string, unknown> = { summary: request.title };
  if (parameters.length > 0) {
    item.parameters = parameters;
  }
  if (request.body !== undefined) {
    item.requestBody = {
      content: {
        [bodyContentType(request)]: { schema: { type: 'string' }, example: request.body },
      },
    };
  }
  return item;
}

/** The whole file as an OpenAPI 3.1 JSON document. */
function toOpenApi(httpFile: HttpFile): string {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const request of httpFile.requests) {
    const path = pathOf(request);
    paths[path] ??= {};
    paths[path][request.method.toLowerCase()] = operation(request);
  }
  return JSON.stringify(
    {
      openapi: '3.1.0',
      info: { title: 'Standard Notes API Client requests', version: '1.0.0' },
      paths,
    },
    null,
    2
  );
}

export { toOpenApi };
