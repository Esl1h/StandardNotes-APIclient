import {
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
  type StreamParser,
  type StringStream,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Line-oriented highlighter for the .http syntax. State tracks whether the
 * tokenizer is between an url/headers context or inside a request body,
 * plus the captured content-type; a multipart body colors its boundary
 * delimiter and part-header lines, and a GraphQL body its keywords,
 * variables, strings and comments.
 *
 * Cosmetic-only layer: the parser owns the semantics, mismatches here
 * never change what a block does.
 */
interface HttpState {
  method: 'idle' | 'headers' | 'body';
  /** The content-type header value captured while tokenizing the headers */
  contentType?: string;
  /** Decided from the first body line; plain bodies stay unstyled */
  bodyKind?: 'multipart' | 'graphql' | 'plain';
  /** True between the """ quotes of a GraphQL block string */
  inBlockString?: boolean;
}

const GRAPHQL_KEYWORDS = /^(?:query|mutation|subscription|fragment|on)\b/;

/** The body kind is decided by its first non-comment line: a leading `#`
 * line is not decisive, since it may be plain body text (the parser owns
 * that call) and must not lock the block into a kind. */
function decideBodyKind(state: HttpState, line: string): void {
  if (state.bodyKind === undefined && !/^\s*#/.test(line)) {
    state.bodyKind = detectBodyKind(state, line);
  }
}

/** One stretch of a GraphQL line: keywords, variables, strings (including
 * block strings, which span lines) and comments; the rest stays plain. */
function graphqlToken(stream: StringStream, state: HttpState): string | null {
  // A GraphQL comment starts at a `#` anywhere, including after fields.
  if (stream.match(/^\s*#.*/)) {
    return 'comment';
  }
  if (state.inBlockString) {
    // The whole line is string text until a closing """ appears on it.
    if (stream.string.includes('"""', stream.pos)) {
      state.inBlockString = false;
    }
    stream.skipToEnd();
    return 'string';
  }
  if (stream.match(/^"""/)) {
    // A block string opens; it only closes on the same line when a second
    // """ follows, otherwise it swallows the next lines.
    if (!stream.string.includes('"""', stream.pos)) {
      state.inBlockString = true;
    }
    stream.skipToEnd();
    return 'string';
  }
  if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
    return 'string';
  }
  if (stream.match(/^'(?:[^'\\]|\\.)*'/)) {
    return 'string';
  }
  if (stream.match(/^\$[A-Za-z_]\w*/)) {
    return 'variableName';
  }
  if (stream.match(GRAPHQL_KEYWORDS)) {
    return 'keyword';
  }
  if (stream.match(/\S+/)) {
    return null;
  }
  stream.next();
  return null;
}

/** Which body a line belongs to, from the captured content-type or the
 * first line's shape; a JSON body starting with `{` stays plain, so
 * shorthand GraphQL without an operation word is not misread. */
function detectBodyKind(state: HttpState, line: string): NonNullable<HttpState['bodyKind']> {
  const contentType = (state.contentType ?? '').toLowerCase();
  if (contentType.startsWith('multipart/')) {
    return 'multipart';
  }
  if (contentType.includes('graphql')) {
    return 'graphql';
  }
  if (/^\s*(?:"""|(?:query|mutation|subscription|fragment)\b)/.test(line)) {
    return 'graphql';
  }
  return 'plain';
}

const httpStreamParser: StreamParser<HttpState> = {
  name: 'http',
  startState() {
    return { method: 'idle' };
  },
  token(stream, state) {
    // Leading whitespace: consume it so indented lines (JSON bodies) advance.
    if (stream.sol() && stream.eatSpace()) {
      // The parser treats whitespace-only lines as blank, so mirror that.
      if (stream.eol() && state.method === 'headers') {
        state.method = 'body';
      }
      return null;
    }
    if (stream.sol()) {
      if (stream.match(/^#{3}.*$/)) {
        state.method = 'idle';
        state.contentType = undefined;
        state.bodyKind = undefined;
        state.inBlockString = false;
        return 'heading';
      }
      // Inside a body these lines are plain text to the parser.
      if (state.method !== 'body') {
        if (stream.match(/^@[\w.-]+\s*=.*$/)) {
          return 'variableName';
        }
        if (stream.match(/^(?:#|\/\/).*$/)) {
          return 'comment';
        }
      }
      // Same shape as the parser's request line, and only before the first
      // request of the block: a later one without `###` is body text.
      if (state.method === 'idle' && stream.match(/^[A-Za-z]+(?=\s+\S+(?:\s+HTTP\/[\d.]+)?\s*$)/)) {
        state.method = 'headers';
        state.bodyKind = undefined;
        state.inBlockString = false;
        return 'keyword';
      }
      if (state.method === 'idle' && stream.match(/^(?:https?:\/\/\S+|\{\{[^}]*\}\}\S*)/)) {
        state.method = 'headers';
        state.bodyKind = undefined;
        state.inBlockString = false;
        return 'url';
      }
      if (state.method === 'headers') {
        if (stream.match(/^[\w-]+\s*:/)) {
          const header = stream.string;
          const contentType = /^content-type\s*:\s*(.+)$/i.exec(header);
          if (contentType) {
            state.contentType = contentType[1].trim();
          }
          return 'propertyName';
        }
      }
      // Multipart and GraphQL bodies get their own tokens; plain bodies
      // fall through to the word-by-word default below.
      if (state.method === 'body') {
        decideBodyKind(state, stream.string);
        if (state.bodyKind === 'multipart') {
          if (stream.match(/^--\S*/)) {
            return 'meta';
          }
          if (stream.match(/^[\w-]+\s*:/)) {
            return 'propertyName';
          }
          stream.skipToEnd();
          return null;
        }
        if (state.bodyKind === 'graphql') {
          return graphqlToken(stream, state);
        }
      }
      // Guarantee progress: StreamLanguage throws if a token call does not advance.
      if (!stream.match(/\S+/)) {
        stream.next();
      }
      return null;
    }
    // Mid-line continuation after method word or header name.
    if (stream.eatSpace()) {
      return null;
    }
    if (state.method === 'body') {
      // The body kind is decided by its first line, then stays.
      decideBodyKind(state, stream.string);
      if (state.bodyKind === 'multipart') {
        stream.skipToEnd();
        return null;
      }
      if (state.bodyKind === 'graphql') {
        return graphqlToken(stream, state);
      }
      stream.skipToEnd();
      return null;
    }
    if (stream.match(/^HTTP\/[\d.]+(?=\s|$)/)) {
      return 'meta';
    }
    if (stream.match(/\S+/)) {
      return state.method === 'headers' ? 'propertyName' : 'url';
    }
    stream.next();
    return null;
  },
  // StreamLanguage never calls token() for empty lines, so the headers/body
  // switch has to live here.
  blankLine(state) {
    if (state.method === 'headers') {
      state.method = 'body';
    }
  },
  tokenTable: {
    heading: t.heading,
    keyword: t.keyword,
    url: t.url,
    propertyName: t.propertyName,
    variableName: t.variableName,
    string: t.string,
    comment: t.comment,
    meta: t.meta,
  },
};

const httpHighlighter = StreamLanguage.define(httpStreamParser);

const httpHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--sn-stylekit-info-color)', fontWeight: '600' },
  { tag: t.keyword, color: 'var(--sn-stylekit-success-color)', fontWeight: '600' },
  { tag: t.url, color: 'var(--sn-stylekit-info-color)' },
  { tag: t.propertyName, color: 'var(--sn-stylekit-info-color)' },
  { tag: t.variableName, color: 'var(--sn-stylekit-neutral-color)' },
  { tag: t.string, color: 'var(--sn-stylekit-foreground-color)' },
  { tag: t.comment, color: 'var(--sn-stylekit-neutral-color)', fontStyle: 'italic' },
  { tag: t.meta, color: 'var(--sn-stylekit-neutral-color)' },
]);

/** Theme and highlighting extensions to compose into the editor.
 * Colors come from StyleKit so the highlight follows the app theme. */
const httpHighlightExtensions = [httpHighlighter, syntaxHighlighting(httpHighlightStyle)];

/** The base editor styling with StyleKit variables */
const httpEditorTheme = () =>
  EditorView.theme({
    '&': {
      backgroundColor: 'var(--sn-stylekit-contrast-background-color)',
      color: 'var(--sn-stylekit-contrast-foreground-color)',
      fontFamily: 'var(--sn-stylekit-monospace-font, monospace)',
      fontSize: 'var(--sn-stylekit-font-size-editor)',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { caretColor: 'var(--sn-stylekit-info-color)' },
    '.cm-line': { padding: '0 10px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--sn-stylekit-info-color-translucent)',
    },
  });

export { httpStreamParser, httpHighlighter, httpHighlightExtensions, httpEditorTheme };
