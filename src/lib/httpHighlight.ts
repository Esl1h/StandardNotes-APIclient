import {
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
  type StreamParser,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Line-oriented highlighter for the .http syntax. State tracks whether the
 * tokenizer is between an url/headers context or inside a request body.
 *
 * Cosmetic-only layer: the parser owns the semantics, mismatches here
 * never change what a block does.
 */
interface HttpState {
  method: 'idle' | 'headers' | 'body';
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
        return 'keyword';
      }
      if (state.method === 'idle' && stream.match(/^(?:https?:\/\/\S+|\{\{[^}]*\}\}\S*)/)) {
        state.method = 'headers';
        return 'url';
      }
      if (state.method === 'headers') {
        if (stream.match(/^[\w-]+\s*:/)) {
          return 'propertyName';
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
