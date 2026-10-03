import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { httpHighlightExtensions } from './httpHighlight';

/** Forces a full parse; StreamLanguage throws if a token call does not advance. */
function parseFully(text: string) {
  const state = EditorState.create({ doc: text, extensions: httpHighlightExtensions });
  return ensureSyntaxTree(state, state.doc.length, 5000);
}

describe('httpHighlighter', () => {
  it('does not throw on an indented JSON body', () => {
    const text = [
      '### Create',
      'POST https://httpbin.org/post',
      'Content-Type: application/json',
      '',
      '{',
      '  "a": 1',
      '}',
    ].join('\n');

    expect(() => parseFully(text)).not.toThrow();
  });

  it.each([
    ['indented line', '  indented'],
    ['tab-indented line', '\tindented'],
    ['whitespace-only line', '   '],
    ['tab-only line', '\t'],
    ['blank lines', '\n\n\n'],
    ['indented line right after a request line', 'GET https://x.y\n  continued'],
    ['indented line in the headers', 'GET https://x.y\n  X-A: 1\n'],
    ['crlf endings', 'GET https://x.y\r\nAccept: */*\r\n\r\n{\r\n  "a": 1\r\n}\r\n'],
  ])('does not throw on %s', (_name, text) => {
    expect(() => parseFully(text)).not.toThrow();
  });

  describe('body highlighting', () => {
    function tokenNames(text: string): string[] {
      const names: string[] = [];
      parseFully(text)?.iterate({ enter: (node) => void names.push(node.name) });
      return names;
    }

    const head = 'POST https://x.y\nAccept: */*\n';
    const headerLikeTokens = (text: string) =>
      tokenNames(text).filter((name) => name === 'url' || name === 'propertyName').length;

    it('does not color body words as headers or urls', () => {
      expect(headerLikeTokens(`${head}\n{ "a": 1 }\n  more body\n`)).toBe(headerLikeTokens(head));
    });

    it('opens the body after a whitespace-only line too', () => {
      expect(headerLikeTokens(`${head}   \nbody words here\n`)).toBe(headerLikeTokens(head));
    });
  });

  it('gives the HTTP version suffix its own token', () => {
    const names: string[] = [];
    parseFully('GET https://x.y HTTP/1.1\n')?.iterate({ enter: (node) => void names.push(node.name) });

    expect(names).toContain('meta');
  });

  it('never throws on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(() => parseFully(text)).not.toThrow();
      })
    );
  });

  it('never throws on arbitrary text built from .http building blocks', () => {
    const piece = fc.constantFrom(
      '### t',
      '@a = 1',
      '# c',
      'GET https://x.y',
      'POST {{h}}/a HTTP/1.1',
      'X-A: 1',
      '  ',
      '\t',
      '',
      '  "k": 1',
      '{',
      '}'
    );
    fc.assert(
      fc.property(fc.array(piece, { maxLength: 20 }), (pieces) => {
        expect(() => parseFully(pieces.join('\n'))).not.toThrow();
      })
    );
  });
});
