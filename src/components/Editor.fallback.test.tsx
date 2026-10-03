import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import Editor from './Editor';

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

// A render crash inside the editor must not take the note away from the user.
vi.mock('./EditorInternal', () => ({
  default: () => {
    throw new Error('editor exploded');
  },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Editor when the editor view crashes', () => {
  it('falls back to a textarea with the note text that still saves', () => {
    const save = vi.fn();
    kit.save = save;
    render(<Editor />);

    act(() => {
      kit.delegate.setEditorRawText('GET https://a.example\n  indented');
      kit.delegate.clearUndoHistory?.();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('editor exploded');
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('GET https://a.example\n  indented');

    fireEvent.change(textarea, { target: { value: 'GET https://b.example' } });

    expect(save).toHaveBeenCalledWith('GET https://b.example');
  });
});
