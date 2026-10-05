import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetResponses,
  getResponse,
  recordResponse,
  resolveChainedRequest,
  resolveChaining,
} from './chaining';
import { type HttpRequest } from './parser';

const okResponse = {
  status: 200,
  timeMs: 5,
  sizeBytes: 10,
  sizeIsDecoded: true,
  headers: { 'Content-Type': 'application/json', 'X-Token': 'abc' },
  body: JSON.stringify({
    token: 'secret-token',
    data: { items: [{ id: 1 }, { id: 2 }] },
  }),
};

beforeEach(() => {
  forgetResponses();
});

describe('resolveChaining', () => {
  it('resolves a body path from a recorded response', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('Bearer {{login.response.body.$.token}}')).toBe('Bearer secret-token');
  });

  it('resolves nested paths with array indexes', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.response.body.$.data.items[0].id}}')).toBe('1');
    expect(resolveChaining('{{login.response.body.$.data.items[1].id}}')).toBe('2');
  });

  it('joins a wildcard over an array with commas', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.response.body.$.data.items[*].id}}')).toBe('1,2');
  });

  it('returns the whole body for a bare body reference', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.response.body}}')).toBe(okResponse.body);
  });

  it('resolves response headers case-insensitively', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.response.headers.x-token}}')).toBe('abc');
    expect(resolveChaining('{{login.response.headers.X-Token}}')).toBe('abc');
  });

  it('keeps the reference literal without a recorded response', () => {
    expect(resolveChaining('{{login.response.body.$.token}}')).toBe(
      '{{login.response.body.$.token}}'
    );
  });

  it('keeps the reference literal when the path finds nothing', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.response.body.$.missing}}')).toBe(
      '{{login.response.body.$.missing}}'
    );
    expect(resolveChaining('{{login.response.body.$.data.items[9].id}}')).toBe(
      '{{login.response.body.$.data.items[9].id}}'
    );
  });

  it('keeps the reference literal when the body is not JSON', () => {
    recordResponse('plain', { ...okResponse, body: 'not json' });

    expect(resolveChaining('{{plain.response.body.$.token}}')).toBe(
      '{{plain.response.body.$.token}}'
    );
  });

  it('keeps a .request reference literal', () => {
    recordResponse('login', okResponse);

    expect(resolveChaining('{{login.request.body.$.token}}')).toBe(
      '{{login.request.body.$.token}}'
    );
  });
});

describe('resolveChainedRequest', () => {
  const request: HttpRequest = {
    title: 'Next',
    name: 'next',
    method: 'GET',
    url: 'https://example.com/x?t={{login.response.body.$.token}}',
    headers: { Authorization: 'Bearer {{login.response.headers.x-token}}' },
    lineIndex: 0,
  };

  it('resolves url, headers and body copies without mutating the original', () => {
    recordResponse('login', okResponse);

    const resolved = resolveChainedRequest({
      ...request,
      body: '{"r": "{{login.response.body.$.token}}"}',
    });

    expect(resolved.url).toBe('https://example.com/x?t=secret-token');
    expect(resolved.headers.Authorization).toBe('Bearer abc');
    expect(resolved.body).toBe('{"r": "secret-token"}');
    // The parsed request stays literal: each execution resolves from the
    // response that is current at that moment.
    expect(request.url).toBe('https://example.com/x?t={{login.response.body.$.token}}');
  });

  it('returns an equal request when nothing resolves', () => {
    const resolved = resolveChainedRequest(request);

    expect(resolved).toEqual(request);
  });
});

describe('response registry', () => {
  it('overwrites the response of a re-run request', () => {
    recordResponse('login', okResponse);
    recordResponse('login', { ...okResponse, body: '{"token": "new"}' });

    expect(resolveChaining('{{login.response.body.$.token}}')).toBe('new');
  });

  it('getResponse reads the registry', () => {
    recordResponse('login', okResponse);

    expect(getResponse('login')).toBe(okResponse);
    expect(getResponse('ghost')).toBeUndefined();
  });
});
