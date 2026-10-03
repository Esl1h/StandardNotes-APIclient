import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  parseHttpFile,
  setActiveEnvironment,
  variableLookup,
} from './parser';

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

  it('parses environment variables with dot suffixes', () => {
    const text = [
      '@host = https://api.example.com',
      '@host.staging = https://staging.example.com',
      '@host.prod = https://prod.example.com',
      'GET https://example.com/ping',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.environments).toEqual(['staging', 'prod']);
    expect(file.variables[0]).toMatchObject({ name: 'host', value: 'https://api.example.com' });
    expect(file.variables[1]).toMatchObject({
      name: 'host',
      env: 'staging',
      value: 'https://staging.example.com',
    });
  });

  it('reads the active environment from the @env declaration', () => {
    const file = parseHttpFile('@env = staging\n@host.staging = https://x\nGET https://example.com');

    expect(file.environment).toBe('staging');
  });

  it('prefers active environment values and falls back to defaults', () => {
    const text = [
      '@env = staging',
      '@host = https://default.example.com',
      '@host.staging = https://staging.example.com',
      '',
      '### Uses staging',
      'GET {{host}}/ping',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests[0].url).toBe('https://staging.example.com/ping');
  });

  it('falls back to defaults when the environment does not define the variable', () => {
    const text = [
      '@env = prod',
      '@host = https://default.example.com',
      '@token.prod = prod-token',
      '@token.staging = staging-token',
      '',
      '### Mixed',
      'GET {{host}}/x',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests[0].url).toBe('https://default.example.com/x');
  });

  it('keeps unknown variables and missing environment refs untouched', () => {
    const file = parseHttpFile('@env = prod\nGET https://example.com/?x={{missing}}');

    expect(file.requests[0].url).toBe('https://example.com/?x={{missing}}');
  });

  it('interpolates qualified environment references explicitly', () => {
    const text = [
      '@env = staging',
      '@token.staging = stg-token',
      '@token.prod = prod-token',
      '',
      '### Explicit',
      'GET https://example.com',
      'Authorization: Bearer {{token.prod}}',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests[0].headers.Authorization).toBe('Bearer prod-token');
  });

  it('interpolates variables chained inside environment values', () => {
    const text = [
      '@base = https://example.com',
      '@host.prod = {{base}}/prodx',
      '',
      'GET {{host.prod}}/ping',
    ].join('\n');

    const file = parseHttpFile(text);

    expect(file.requests[0].url).toBe('https://example.com/prodx/ping');
  });

  it('updates the @env line with setActiveEnvironment', () => {
    expect(setActiveEnvironment('A\n@env = staging\nB', 'prod')).toBe('A\n@env = prod\nB');
    expect(setActiveEnvironment('@env = staging\nB', null)).toBe('B');
    expect(setActiveEnvironment('A only', 'dev')).toBe('@env = dev\nA only');
  });

  it('variableLookup checks environment scope before base', () => {
    const lookup = variableLookup(
      [
        { name: 'host', value: 'default', lineIndex: 0 },
        { name: 'host', env: 'staging', value: 'staging', lineIndex: 1 },
      ],
      'staging'
    );

    expect(lookup('host')).toBe('staging');
    expect(lookup('host.staging')).toBe('staging');
    expect(lookup('host.missing')).toBeUndefined();
  });

  it('variableLookup falls back to base when active env lacks the key', () => {
    const lookup = variableLookup(
      [
        { name: 'host', value: 'default', lineIndex: 0 },
        { name: 'token', env: 'staging', value: 'stg', lineIndex: 1 },
      ],
      'staging'
    );

    expect(lookup('host')).toBe('default');
  });

  describe('HTTP version suffix', () => {
    it('accepts the version after the url', () => {
      const file = parseHttpFile('GET https://x.y HTTP/1.1\nAccept: */*\n');

      expect(file.requests).toHaveLength(1);
      expect(file.requests[0]).toMatchObject({
        method: 'GET',
        url: 'https://x.y',
        headers: { Accept: '*/*' },
      });
    });

    it('accepts a short version and resolves variables in the url', () => {
      const file = parseHttpFile('@host = https://h.example\nPOST {{host}}/a HTTP/2\n');

      expect(file.requests).toHaveLength(1);
      expect(file.requests[0]).toMatchObject({ method: 'POST', url: 'https://h.example/a' });
    });

    it('still accepts a request line without a version', () => {
      const file = parseHttpFile('GET https://x.y');

      expect(file.requests[0].url).toBe('https://x.y');
    });
  });

  describe('request body trimming', () => {
    it('gives a GET followed by blank lines no body', () => {
      const file = parseHttpFile('### A\nGET https://example.com\n\n\n### B\n');

      expect(file.requests[0].body).toBeUndefined();
    });

    it('gives a trailing GET with blank lines no body', () => {
      const file = parseHttpFile('GET https://example.com\n\n\n');

      expect(file.requests[0].body).toBeUndefined();
    });

    it('drops trailing whitespace from a body but keeps inner blank lines', () => {
      const file = parseHttpFile('POST https://example.com\n\nline1\n\nline2  \n\n \n### Next\n');

      expect(file.requests[0].body).toBe('line1\n\nline2');
    });
  });

  describe('cyclic variables', () => {
    it.each([
      ['self reference in an environment', '@env = dev\n@a.dev = {{a}}x\nGET https://e.com/{{a}}\n'],
      [
        'indirect cycle in an environment',
        '@env = dev\n@a.dev = {{b}}\n@b.dev = {{a}}\nGET https://e.com/{{a}}\n',
      ],
      ['indirect cycle in the base scope', '@a = {{b}}\n@b = {{a}}\nGET https://e.com/{{a}}\n'],
      ['self reference in the base scope', '@a = {{a}}\nGET https://e.com/{{a}}\n'],
      [
        'base cycle reached from an environment',
        '@env = dev\n@a = {{b}}\n@b = {{a}}\n@c.dev = {{a}}\nGET https://e.com/{{c}}\n',
      ],
      ['qualified reference to itself', '@a.dev = {{a.dev}}\nGET https://e.com/{{a.dev}}\n'],
    ])('does not throw on %s', (_name, text) => {
      expect(() => parseHttpFile(text)).not.toThrow();
    });

    it('leaves the reference that closes a cycle as literal text', () => {
      const file = parseHttpFile('@env = dev\n@a.dev = {{a}}x\nGET https://e.com/{{a}}\n');

      expect(file.requests).toHaveLength(1);
      expect(file.variables.find((variable) => variable.name === 'a')?.value).toBe('{{a}}x');
      expect(file.requests[0].url).toBe('https://e.com/{{a}}x');
    });

    it('still resolves variables that merely share a dependency', () => {
      const text = '@env = dev\n@base = b\n@x.dev = {{base}}1\n@y.dev = {{base}}2\nGET https://e.com/{{x}}{{y}}\n';

      expect(parseHttpFile(text).requests[0].url).toBe('https://e.com/b1b2');
    });
  });

  describe('robustness', () => {
    it('never throws on arbitrary text', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'binary' }), (text) => {
          expect(() => parseHttpFile(text)).not.toThrow();
        })
      );
    });

    it('never throws on text built from .http building blocks', () => {
      const piece = fc.constantFrom(
        '### t',
        '@env = dev',
        '@env = prod',
        '@a = {{b}}',
        '@b = {{a}}',
        '@a.dev = {{a}}x',
        '@b.prod = {{a.dev}}',
        '@c = {{c}}',
        'GET https://x.y/{{a}}',
        'POST {{b}} HTTP/1.1',
        'X-A: {{a}}',
        '',
        '  "k": {{b}}',
        '# c'
      );
      fc.assert(
        fc.property(fc.array(piece, { maxLength: 20 }), (pieces) => {
          expect(() => parseHttpFile(pieces.join('\n'))).not.toThrow();
        })
      );
    });
  });

  describe('// comments', () => {
    it('ignores // comment lines outside request bodies', () => {
      const text = [
        '// top comment',
        '### Block',
        '// before the request line',
        'GET https://example.com/a',
        '// between request line and headers',
        'X-Marker: 1',
        '',
        '{"body": true}',
      ].join('\n');

      const file = parseHttpFile(text);

      expect(file.requests).toHaveLength(1);
      expect(file.requests[0].headers).toEqual({ 'X-Marker': '1' });
      expect(file.requests[0].body).toBe('{"body": true}');
    });

    it('keeps // lines that are part of a body', () => {
      const file = parseHttpFile('POST https://example.com\n\nline1\n// still body\nline3');

      expect(file.requests[0].body).toBe('line1\n// still body\nline3');
    });
  });
});
