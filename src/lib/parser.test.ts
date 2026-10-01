import { describe, expect, it } from 'vitest';
import { parseHttpFile } from './parser';

describe('parseHttpFile', () => {
  it('parses a simple GET request', () => {
    const file = parseHttpFile('GET https://api.github.com/zen');

    expect(file.requests).toHaveLength(1);
    expect(file.requests[0]).toMatchObject({
      title: 'https://api.github.com/zen',
      method: 'GET',
      url: 'https://api.github.com/zen',
      headers: {},
    });
    expect(file.requests[0].body).toBeUndefined();
  });

  it('parses multiple blocks with ### titles', () => {
    const text = [
      '### Health',
      'GET https://example.com/health',
      '',
      '### Create',
      'POST https://example.com/items',
      'Content-Type: application/json',
      '',
      '{"name": "x"}',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests).toHaveLength(2);
    expect(file.requests[0].title).toBe('Health');
    expect(file.requests[0].method).toBe('GET');
    expect(file.requests[1].title).toBe('Create');
    expect(file.requests[1].method).toBe('POST');
    expect(file.requests[1].headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(file.requests[1].body).toBe('{"name": "x"}');
  });

  it('parses variables and interpolates them in url, headers and body', () => {
    const text = [
      '@baseUrl = https://api.example.com/v1',
      '@token = abc123',
      '',
      '### Authenticated',
      'GET {{baseUrl}}/items',
      'Authorization: Bearer {{token}}',
      '',
      '{"env": "{{baseUrl}}"}',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.variables).toEqual([
      { name: 'baseUrl', value: 'https://api.example.com/v1', lineIndex: 0 },
      { name: 'token', value: 'abc123', lineIndex: 1 },
    ]);
    const request = file.requests[0];
    expect(request.url).toBe('https://api.example.com/v1/items');
    expect(request.headers.Authorization).toBe('Bearer abc123');
    expect(request.body).toBe('{"env": "https://api.example.com/v1"}');
  });

  it('interpolates variables inside other variables', () => {
    const text = [
      '@proto = https',
      '@host = {{proto}}://example.com',
      '',
      '### Chained',
      'GET {{host}}/ping',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.variables[1]).toMatchObject({
      name: 'host',
      value: 'https://example.com',
    });
    expect(file.requests[0].url).toBe('https://example.com/ping');
  });

  it('keeps unknown variables untouched', () => {
    const file = parseHttpFile('GET https://example.com/?x={{missing}}');

    expect(file.requests[0].url).toBe('https://example.com/?x={{missing}}');
  });

  it('supports URL-only request lines defaulting to GET', () => {
    const file = parseHttpFile('https://example.com/ping');

    expect(file.requests).toHaveLength(1);
    expect(file.requests[0].method).toBe('GET');
    expect(file.requests[0].url).toBe('https://example.com/ping');
  });

  it('ignores comment lines outside request bodies', () => {
    const text = [
      '# top comment',
      '@token = abc',
      '',
      '### Block',
      '# title-ish',
      'GET https://example.com/a',
      'X-Marker: 1',
      '',
      '{"body": true}',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests).toHaveLength(1);
    expect(file.requests[0].body).toBe('{"body": true}');
  });

  it('preserves blank lines inside a body', () => {
    const text = [
      '',
      '### Body with blanks',
      'GET https://example.com/a',
      '',
      'line1',
      '',
      'line2',
    ];

    const file = parseHttpFile(text.join('\n'));

    expect(file.requests[0].body).toBe('line1\n\nline2');
  });

  it('ignores malformed lines instead of throwing', () => {
    const file = parseHttpFile('not a request\n###\n?? bad');

    expect(file.requests).toHaveLength(0);
  });

  it('records the line index of each request', () => {
    const text = [
      '# comment-ish',
      '',
      '### First',
      'GET https://example.com/a',
      '',
      '### Second',
      'POST https://example.com/b',
    ];

    const file = parseHttpFile(text.join('\n'));

    expect(file.requests).toHaveLength(2);
    expect(file.requests[0].lineIndex).toBe(3);
    expect(file.requests[1].lineIndex).toBe(6);
  });
});
