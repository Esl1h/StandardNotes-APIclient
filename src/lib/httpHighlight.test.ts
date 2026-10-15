import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, StringStream } from '@codemirror/language';
import { httpHighlightExtensions, httpStreamParser } from './httpHighlight';

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
    parseFully('GET https://x.y HTTP/1.1\n')?.iterate({
      enter: (node) => void names.push(node.name),
    });

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

/** Runs the stream parser line by line, as the editor does. */
function tokens(text: string): Array<[string, string | null]> {
  const state = httpStreamParser.startState!(2);
  const out: Array<[string, string | null]> = [];
  for (const line of text.split('\n')) {
    if (line === '') {
      httpStreamParser.blankLine?.(state, 2);
      continue;
    }
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      const style = httpStreamParser.token(stream, state);
      out.push([stream.current(), style]);
      stream.start = stream.pos;
    }
  }
  return out;
}

describe('httpStreamParser follows the parser', () => {
  it.each([
    ['a lowercase method', 'get https://x.y', 'get'],
    ['a method outside the usual list', 'PROPFIND https://x.y', 'PROPFIND'],
  ])('colors %s as a keyword', (_name, text, method) => {
    expect(tokens(text)).toContainEqual([method, 'keyword']);
  });

  it('does not color a comment line inside a body', () => {
    const styles = tokens('POST https://x\n\n# not a comment').map(([, style]) => style);

    expect(styles).not.toContain('comment');
  });

  it('does not color a variable line inside a body', () => {
    const styles = tokens('POST https://x\n\n@a = 1').map(([, style]) => style);

    expect(styles).not.toContain('variableName');
  });

  it('colors a comment before the first request', () => {
    expect(tokens('# real comment\nGET https://x')[0]).toEqual(['# real comment', 'comment']);
  });

  it('colors multipart boundary and part-header lines', () => {
    const text = [
      'POST https://x.y/upload',
      'Content-Type: multipart/form-data; boundary=X',
      '',
      '--X',
      'Content-Disposition: form-data; name="a"',
      '',
      'value',
      '--X--',
    ].join('\n');
    const styles = tokens(text);

    expect(styles).toContainEqual(['--X', 'meta']);
    expect(styles).toContainEqual(['--X--', 'meta']);
    expect(styles).toContainEqual(['Content-Disposition:', 'propertyName']);
    expect(styles).toContainEqual(['value', null]);
  });

  it('colors GraphQL keywords, variables and comments', () => {
    const text = [
      'POST https://x.y/graphql',
      'Content-Type: application/json',
      '',
      'query Get($id: ID!) {',
      '  cat(id: $id) { name }',
      '  # a comment',
      '}',
    ].join('\n');
    const styles = tokens(text);

    expect(styles).toContainEqual(['query', 'keyword']);
    expect(styles).toContainEqual(['cat(id:', null]);
    expect(styles).toContainEqual(['$id', 'variableName']);
    expect(styles).toContainEqual(['# a comment', 'comment']);
  });

  it('defers the body kind past a leading comment line', () => {
    const text = [
      'POST https://x.y',
      'Content-Type: application/json',
      '',
      '# body comment',
      'query Q { f }',
    ].join('\n');
    const styles = tokens(text);

    // The leading comment stays plain body text and does not lock the
    // block into plain: the query line below still decides GraphQL.
    expect(styles).toContainEqual(['#', null]);
    expect(styles).toContainEqual(['body comment', null]);
    expect(styles).toContainEqual(['query', 'keyword']);
  });

  it('detects GraphQL from the content-type alone', () => {
    const text = [
      'POST https://x.y/graphql',
      'Content-Type: application/graphql',
      '',
      'query Q { f }',
    ].join('\n');

    expect(tokens(text)).toContainEqual(['query', 'keyword']);
  });

  it('colors GraphQL block strings across lines', () => {
    const text = [
      'POST https://x.y/graphql',
      'Content-Type: application/json',
      '',
      '"""',
      'documentation text',
      '"""',
      'query Q { f }',
    ].join('\n');
    const styles = tokens(text);

    expect(styles).toContainEqual(['"""', 'string']);
    expect(styles).toContainEqual(['documentation text', 'string']);
    expect(styles).toContainEqual(['query', 'keyword']);
  });

  it('keeps a JSON body plain', () => {
    const styles = tokens('POST https://x.y\nContent-Type: application/json\n\n{"a": "b"}');

    expect(styles).toContainEqual(['{"a":', null]);
    expect(styles).not.toContainEqual(['{"a":', 'keyword']);
  });
});
