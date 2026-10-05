import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseHttpFile, setActiveEnvironment, unresolvedVariables } from './parser';

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
    const file = parseHttpFile(
      '@env = staging\n@host.staging = https://x\nGET https://example.com'
    );

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

  it('checks the environment scope before the default one', () => {
    const text = [
      '@host = default',
      '@host.staging = staging',
      '@env = staging',
      '### A',
      'GET https://{{host}}/a',
      '',
      '### B',
      'GET https://{{host.staging}}/b',
      '',
      '### C',
      'GET https://{{host.missing}}/c',
      '',
    ].join('\n');

    expect(parseHttpFile(text).requests.map((request) => request.url)).toEqual([
      'https://staging/a',
      'https://staging/b',
      'https://{{host.missing}}/c',
    ]);
  });

  it('falls back to the default scope when the active environment lacks the key', () => {
    const text = '@host = default\n@token.staging = stg\n@env = staging\nGET https://{{host}}/\n';

    expect(parseHttpFile(text).requests[0].url).toBe('https://default/');
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

  describe('variable resolution', () => {
    const urlOf = (text: string) => parseHttpFile(text).requests[0].url;

    it('resolves a qualified reference in its own environment', () => {
      const text = [
        '@env = dev',
        '@host.dev = dev.x',
        '@host.prod = prod.x',
        '@url.dev = {{host.prod}}/a',
        'GET https://{{url}}',
      ].join('\n');

      expect(urlOf(text)).toBe('https://prod.x/a');
    });

    it('resolves a chain declared in reverse order', () => {
      expect(urlOf('@a = {{b}}\n@b = {{c}}\n@c = 1\nGET https://e/{{a}}\n')).toBe('https://e/1');
    });

    it('leaves a cycle between environments literal without throwing', () => {
      const text = '@env = dev\n@a.dev = {{a.prod}}\n@a.prod = {{a.dev}}\nGET https://e/{{a}}\n';

      expect(urlOf(text)).toBe('https://e/{{a.dev}}');
    });

    it('lets the default scope reference an environment explicitly', () => {
      expect(urlOf('@h.dev = d\n@u = {{h.dev}}/p\nGET https://{{u}}\n')).toBe('https://d/p');
    });
  });

  describe('unresolved variables', () => {
    const unresolved = (text: string) =>
      unresolvedVariables(parseHttpFile(text).requests[0], new Set<string>());

    it('lists the names left in the url, headers and body, once each', () => {
      const text = [
        'POST https://{{host}}/{{id}}',
        'X-Token: {{token}}',
        '',
        '{"id": "{{id}}"}',
      ].join('\n');

      expect(unresolved(text)).toEqual(['host', 'id', 'token']);
    });

    it('skips the variables that were declared', () => {
      expect(unresolved('@host = h\nGET https://{{host}}/{{id}}\n')).toEqual(['id']);
    });

    it('lists a qualified reference to a missing environment as written', () => {
      expect(unresolved('@host = h\nGET https://{{host.missing}}/\n')).toEqual(['host.missing']);
    });

    it('is empty when everything resolved', () => {
      expect(unresolved('@host = h\nGET https://{{host}}/\n')).toEqual([]);
    });
  });

  describe('cyclic variables', () => {
    it.each([
      [
        'self reference in an environment',
        '@env = dev\n@a.dev = {{a}}x\nGET https://e.com/{{a}}\n',
      ],
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
      const text =
        '@env = dev\n@base = b\n@x.dev = {{base}}1\n@y.dev = {{base}}2\nGET https://e.com/{{x}}{{y}}\n';

      expect(parseHttpFile(text).requests[0].url).toBe('https://e.com/b1b2');
    });
  });

  describe('# @name labels', () => {
    it('labels the next request for chaining', () => {
      const file = parseHttpFile('### Login\n# @name login\nPOST https://example.com/login\n');

      expect(file.requests[0].name).toBe('login');
    });

    it('labels a request from a name line after the request line', () => {
      const file = parseHttpFile('POST https://example.com/login\n# @name login\nAccept: */*\n');

      expect(file.requests[0].name).toBe('login');
    });

    it('keeps a # @name line inside a body as body text', () => {
      const file = parseHttpFile('POST https://example.com\n\n# @name login\nbody\n');

      expect(file.requests[0].body).toBe('# @name login\nbody');
      expect(file.requests[0].name).toBeUndefined();
    });

    it('does not carry a label into the next block', () => {
      const file = parseHttpFile(
        '# @name login\nPOST https://example.com/a\n\n### B\nGET https://example.com/b\n'
      );

      expect(file.requests[0].name).toBe('login');
      expect(file.requests[1].name).toBeUndefined();
    });

    it('does not treat # @name as a variable declaration', () => {
      const file = parseHttpFile('# @name login\nPOST https://example.com/a\n');

      expect(file.variables).toHaveLength(0);
    });
  });

  describe('chaining references', () => {
    const unresolvedWith = (text: string, names: string[]) =>
      unresolvedVariables(parseHttpFile(text).requests[0], new Set(names));

    it('leaves dynamic variables literal for run-time generation', () => {
      const file = parseHttpFile('GET https://example.com/{{$uuid}}\nX-T: {{$randomInt 1 5}}\n');

      expect(file.requests[0].url).toBe('https://example.com/{{$uuid}}');
      expect(file.requests[0].headers['X-T']).toBe('{{$randomInt 1 5}}');
      expect(unresolvedWith('GET https://example.com/{{$uuid}}', [])).toEqual([]);
    });

    it('leaves response references literal for run-time resolution', () => {
      const text = [
        '# @name login',
        'POST https://example.com/login',
        '',
        '### Next',
        'GET https://example.com/x',
        'Authorization: Bearer {{login.response.body.$.token}}',
      ].join('\n');

      const file = parseHttpFile(text);

      expect(file.requests[1].headers.Authorization).toBe('Bearer {{login.response.body.$.token}}');
    });

    it('skips warnings for references to labeled requests', () => {
      const text = 'GET https://example.com/x\nX-Token: {{login.response.headers.X-Token}}\n';

      expect(unresolvedWith(text, ['login'])).toEqual([]);
    });

    it('lists references to labels that do not exist as written', () => {
      const text = 'GET https://example.com/x\nX-Token: {{ghost.response.body.$.token}}\n';

      expect(unresolvedWith(text, ['login'])).toEqual(['ghost.response.body.$.token']);
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

  describe('repeated headers', () => {
    it('joins repeated headers with a comma, as fetch would on the wire', () => {
      const file = parseHttpFile('GET https://x.y\nAccept: text/html\nAccept: application/json\n');

      expect(file.requests[0].headers).toEqual({ Accept: 'text/html, application/json' });
    });

    it('joins repeated Cookie headers with a semicolon', () => {
      const file = parseHttpFile('GET https://x.y\nCookie: a=1\nCookie: b=2\n');

      expect(file.requests[0].headers).toEqual({ Cookie: 'a=1; b=2' });
    });

    it('treats names that differ only in case as one header, keeping the first spelling', () => {
      const file = parseHttpFile('GET https://x.y\ncontent-type: a\nContent-Type: b\n');

      expect(file.requests[0].headers).toEqual({ 'content-type': 'a, b' });
    });

    it('does not mix headers across requests', () => {
      const file = parseHttpFile(
        'GET https://x.y\nAccept: a\n\n### Two\nGET https://x.y\nAccept: b\n'
      );

      expect(file.requests[0].headers).toEqual({ Accept: 'a' });
      expect(file.requests[1].headers).toEqual({ Accept: 'b' });
    });
  });

  describe('multiline query strings', () => {
    it('appends ? and & continuation lines to the url', () => {
      const text = ['GET https://x.y/search', '  ?q=term', '  &page=2', 'Accept: */*', ''].join(
        '\n'
      );

      const file = parseHttpFile(text);

      expect(file.requests[0].url).toBe('https://x.y/search?q=term&page=2');
      expect(file.requests[0].headers).toEqual({ Accept: '*/*' });
    });

    it('resolves variables inside continuation lines', () => {
      const file = parseHttpFile('@q = abc\nGET https://x.y/s\n?q={{q}}\n');

      expect(file.requests[0].url).toBe('https://x.y/s?q=abc');
    });

    it('leaves a ? line in the body untouched', () => {
      const file = parseHttpFile('POST https://x.y\n\n?not=a-query\n');

      expect(file.requests[0].url).toBe('https://x.y');
      expect(file.requests[0].body).toBe('?not=a-query');
    });
  });

  describe('url-only lines starting with a variable', () => {
    it('accepts {{baseUrl}}/path without a method, defaulting to GET', () => {
      const file = parseHttpFile(
        '@baseUrl = https://api.example.com\n\n### Ping\n{{baseUrl}}/ping\n'
      );

      expect(file.requests).toHaveLength(1);
      expect(file.requests[0]).toMatchObject({
        method: 'GET',
        url: 'https://api.example.com/ping',
        title: 'Ping',
      });
    });

    it('accepts spaces inside the braces and an HTTP version', () => {
      const file = parseHttpFile('@h = https://x.y\n{{ h }}/a HTTP/1.1\nAccept: */*\n');

      expect(file.requests[0]).toMatchObject({ method: 'GET', url: 'https://x.y/a' });
      expect(file.requests[0].headers).toEqual({ Accept: '*/*' });
    });

    it('does not start a request from a {{variable}} line inside a body', () => {
      const file = parseHttpFile('POST https://x.y\n\n{{token}}\n');

      expect(file.requests).toHaveLength(1);
      expect(file.requests[0].body).toBe('{{token}}');
    });
  });
});
