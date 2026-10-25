import { describe, expect, it } from 'vitest';
import { toOpenApi } from './openapi';
import { parseHttpFile } from './parser';

// The exported document is walked freely in these tests; an alias keeps the
// single lint exception in one place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Parses an .http text and exports its OpenAPI document, parsed back. */
function exported(text: string): Json {
  return JSON.parse(toOpenApi(parseHttpFile(text)));
}

describe('toOpenApi', () => {
  it('maps each block to one operation with its method and summary', () => {
    const doc = exported('### List cats\nGET https://x.y/cats?limit=10\n');

    expect(doc.paths['/cats'].get.summary).toBe('List cats');
  });

  it('maps the query string to query parameters', () => {
    const doc = exported('GET https://x.y/cats?limit=10&tag=a&tag=b\n');

    expect(doc.paths['/cats'].get.parameters).toEqual([
      { name: 'limit', in: 'query', schema: { type: 'string' } },
      { name: 'tag', in: 'query', schema: { type: 'string' } },
    ]);
  });

  it('maps headers to header parameters and the body to an example', () => {
    const doc = exported(
      [
        'POST https://x.y/cats',
        'Content-Type: application/json',
        'X-Trace: 1',
        '',
        '{"a": 1}',
      ].join('\n')
    );

    expect(doc.paths['/cats'].post.parameters).toContainEqual({
      name: 'X-Trace',
      in: 'header',
      schema: { type: 'string' },
    });
    expect(doc.paths['/cats'].post.requestBody.content['application/json'].example).toBe(
      '{"a": 1}'
    );
  });

  it('defaults the body content type to text/plain', () => {
    const doc = exported('POST https://x.y/cats\n\nplain body\n');

    expect(doc.paths['/cats'].post.requestBody.content['text/plain'].example).toBe('plain body');
  });

  it('keeps an unparsable url as the raw path text', () => {
    const doc = exported('GET {{host}}/cats\n');

    expect(doc.paths['{{host}}/cats'].get).toBeDefined();
  });

  it('collapses duplicate path and method into the last block', () => {
    const doc = exported(
      ['### One', 'GET https://x.y/a', '', '### Two', 'GET https://x.y/a'].join('\n')
    );

    expect(doc.paths['/a'].get.summary).toBe('Two');
  });

  it('emits a parseable OpenAPI 3.1 document root', () => {
    const doc = exported('GET https://x.y/a\n');

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'Standard Notes API Client requests', version: '1.0.0' });
  });

  it('keeps a __proto__ path a plain key, off the shared prototype', () => {
    const doc = exported('CREDENTIALS __proto__\n###\nGET constructor\n');

    expect(({} as Json).credentials).toBeUndefined();
    expect(Object.getOwnPropertyNames(doc.paths)).toEqual(['__proto__', 'constructor']);
    expect(doc.paths.constructor.get).toBeDefined();
  });
});
