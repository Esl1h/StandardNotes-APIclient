import { describe, expect, it } from 'vitest';
import { findIgnoredHeaders } from './forbiddenHeaders';

describe('findIgnoredHeaders', () => {
  it('returns nothing for ordinary headers', () => {
    expect(findIgnoredHeaders({ Accept: '*/*', Authorization: 'Bearer x' })).toEqual([]);
  });

  it('flags the headers a browser never lets a page set', () => {
    expect(
      findIgnoredHeaders({
        Host: 'example.com',
        Cookie: 'a=1',
        Origin: 'https://x.y',
        'Content-Length': '4',
        Accept: '*/*',
      })
    ).toEqual(['Host', 'Cookie', 'Origin', 'Content-Length']);
  });

  it('ignores the case of the name and keeps the declared spelling', () => {
    expect(findIgnoredHeaders({ host: 'a', rEfErEr: 'b', Accept: 'c' })).toEqual([
      'host',
      'rEfErEr',
    ]);
  });

  it('flags the Proxy- and Sec- prefixes', () => {
    expect(findIgnoredHeaders({ 'Proxy-Authorization': 'x', 'Sec-Fetch-Mode': 'cors' })).toEqual([
      'Proxy-Authorization',
      'Sec-Fetch-Mode',
    ]);
  });
});
