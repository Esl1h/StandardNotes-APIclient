import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import Editor from './Editor';

// Capture the delegate the Editor hands to EditorKit and observe saves, so the
// tests drive the same calls the real EditorKit makes against the delegate.
const kit = vi.hoisted(() => ({
  delegate: undefined as unknown as EditorKitDelegate,
  save: undefined as unknown as (text: string) => void,
}));

vi.mock('@standardnotes/editor-kit', () => ({
  default: class {
    constructor(delegate: EditorKitDelegate) {
      kit.delegate = delegate;
    }
    onEditorValueChanged = (text: string) => kit.save(text);
  },
}));

/**
 * Notes are loaded exactly as EditorKit does it: setEditorRawText first, then
 * clearUndoHistory when the note changed.
 */
function setup() {
  const save = vi.fn();
  kit.save = save;
  const { container } = render(<Editor />);
  const delegate = kit.delegate;
  const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;

  return {
    save,
    view,
    container,
    loadNote: (text: string) =>
      act(() => {
        delegate.setEditorRawText(text);
        delegate.clearUndoHistory?.();
      }),
    syncRemote: (text: string) => act(() => delegate.setEditorRawText(text)),
    type: (text: string) =>
      act(() => {
        view.dispatch({
          changes: { from: view.state.doc.length, insert: text },
          userEvent: 'input.type',
        });
      }),
  };
}

describe('Editor', () => {
  it('does not save when a note is loaded or synced', () => {
    const { view, save, loadNote, syncRemote } = setup();

    loadNote('GET https://a.example');
    expect(view.state.doc.toString()).toBe('GET https://a.example');

    syncRemote('GET https://a.example/changed');
    expect(view.state.doc.toString()).toBe('GET https://a.example/changed');

    expect(save).not.toHaveBeenCalled();
  });

  it('saves exactly once per user edit', () => {
    const { save, loadNote, type } = setup();
    loadNote('GET https://a.example');

    type('?x=1');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('GET https://a.example?x=1');
  });

  it('marks the block of the request under the caret as active', () => {
    const { view, container, loadNote } = setup();
    loadNote('### One\nGET https://a.example\n\n### Two\nGET https://b.example\n');

    act(() => {
      view.dispatch({ selection: { anchor: view.state.doc.line(5).from } });
    });

    const blocks = container.querySelectorAll('.block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).not.toHaveClass('active');
    expect(blocks[1]).toHaveClass('active');
  });
});
