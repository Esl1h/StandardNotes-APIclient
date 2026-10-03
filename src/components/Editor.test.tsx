import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
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

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Notes are loaded exactly as EditorKit does it: setEditorRawText first, then
 * clearUndoHistory when the note changed. The CodeMirror view only exists once
 * the first note has arrived.
 */
function setup() {
  const save = vi.fn();
  kit.save = save;
  const { container } = render(<Editor />);
  const delegate = kit.delegate;
  const getView = () =>
    EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;

  return {
    save,
    getView,
    container,
    loadNote: (text: string) =>
      act(() => {
        delegate.setEditorRawText(text);
        delegate.clearUndoHistory?.();
      }),
    syncRemote: (text: string) => act(() => delegate.setEditorRawText(text)),
    type: (text: string) =>
      act(() => {
        const view = getView();
        view.dispatch({
          changes: { from: view.state.doc.length, insert: text },
          userEvent: 'input.type',
        });
      }),
  };
}

describe('Editor', () => {
  it('does not save when a note is loaded or synced', () => {
    const { getView, save, loadNote, syncRemote } = setup();

    loadNote('GET https://a.example');
    expect(getView().state.doc.toString()).toBe('GET https://a.example');

    syncRemote('GET https://a.example/changed');
    expect(getView().state.doc.toString()).toBe('GET https://a.example/changed');

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
    const { getView, container, loadNote } = setup();
    loadNote('### One\nGET https://a.example\n\n### Two\nGET https://b.example\n');

    act(() => {
      const view = getView();
      view.dispatch({ selection: { anchor: view.state.doc.line(5).from } });
    });

    const blocks = container.querySelectorAll('.block');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).not.toHaveClass('active');
    expect(blocks[1]).toHaveClass('active');
  });

  it('does not let undo restore the text of the previous note', () => {
    const { getView, save, loadNote, type } = setup();
    loadNote('GET https://note-a.example');
    type('/typed-in-a');
    save.mockClear();

    loadNote('GET https://note-b.example');
    act(() => {
      undo(getView());
    });

    expect(getView().state.doc.toString()).toBe('GET https://note-b.example');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not let undo revert a remote update of the same note', () => {
    const { getView, loadNote, syncRemote, type } = setup();
    loadNote('GET https://a.example');
    type('/typed');

    syncRemote('GET https://a.example/from-another-device');
    act(() => {
      undo(getView());
    });

    expect(getView().state.doc.toString()).toBe('GET https://a.example/from-another-device');
  });
});

describe('Editor while waiting for the note', () => {
  it('shows a waiting state instead of an editable placeholder', () => {
    const { container } = setup();

    expect(screen.getByRole('status')).toHaveTextContent(/waiting for the note/i);
    expect(container.querySelector('.cm-editor')).toBeNull();
  });

  it('says the note was not received after 5 seconds', () => {
    vi.useFakeTimers();
    setup();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for the note/i);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/not received from standard notes/i);
  });

  it('swaps in the editor with the note text when it arrives late', () => {
    vi.useFakeTimers();
    const { container, getView, loadNote } = setup();
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    loadNote('GET https://late.example');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    expect(getView().state.doc.toString()).toBe('GET https://late.example');
  });
});
