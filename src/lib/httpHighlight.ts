import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Line-oriented highlighter for the .http syntax. State tracks whether the
 * tokenizer is between an url/headers context or inside a request body.
 *
 * Cosmetic-only layer: the parser owns the semantics, mismatches here
 * never change what a block does.
 */
const httpHighlighter = StreamLanguage.define({
  name: 'http',
  startState() {
    return { method: 'idle' as 'idle' | 'headers' | 'body' };
  },
  token(stream, state) {
    if (stream.sol()) {
      if (stream.match(/^#{3}.*$/)) {
        state.method = 'idle';
        return 'heading';
      }
      if (stream.match(/^@[\w.-]+\s*=.*$/)) {
        return 'variableName';
      }
      if (stream.match(/^#.*$/)) {
        return 'comment';
      }
      if (
        state.method !== 'body' &&
        stream.match(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\b/)
      ) {
        state.method = 'headers';
        return 'keyword';
      }
      if (state.method === 'idle' && stream.match(/^https?:\/\/\S+/)) {
        state.method = 'headers';
        return 'url';
      }
      if (state.method === 'headers') {
        if (stream.match(/^[\w-]+\s*:/)) {
          return 'propertyName';
        }
        if (stream.match(/^$/)) {
          // A blank line closes the headers; the next one opens the body.
          state.method = 'body';
          return null;
        }
      }
      stream.match(/\S+/);
      return null;
    }
    // Mid-line continuation after method word or header name.
    if (stream.match(/\s+/)) {
      return null;
    }
    if (stream.match(/\S+/)) {
      return state.method === 'headers' ? 'propertyName' : 'url';
    }
    stream.next();
    return null;
  },
  tokenTable: {
    heading: t.heading,
    keyword: t.keyword,
    url: t.url,
    propertyName: t.propertyName,
    variableName: t.variableName,
    string: t.string,
    comment: t.comment,
  },
});

const httpHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--sn-stylekit-info-color)', fontWeight: '600' },
  { tag: t.keyword, color: 'var(--sn-stylekit-success-color)', fontWeight: '600' },
  { tag: t.url, color: 'var(--sn-stylekit-info-color)' },
  { tag: t.propertyName, color: 'var(--sn-stylekit-info-color)' },
  { tag: t.variableName, color: 'var(--sn-stylekit-neutral-color)' },
  { tag: t.string, color: 'var(--sn-stylekit-foreground-color)' },
  { tag: t.comment, color: 'var(--sn-stylekit-neutral-color)', fontStyle: 'italic' },
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

export { httpHighlighter, httpHighlightExtensions, httpEditorTheme };
