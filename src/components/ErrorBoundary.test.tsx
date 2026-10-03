import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom({ crash }: { crash: boolean }) {
  if (crash) {
    throw new Error('kaboom');
  }
  return <p>editor is fine</p>;
}

beforeEach(() => {
  // React logs every caught render error; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary rawText="note" onRawTextChange={() => {}} resetKey={0}>
        <Boom crash={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('editor is fine')).toBeInTheDocument();
  });

  it('shows the error and the raw note text in an editable textarea', () => {
    render(
      <ErrorBoundary rawText="GET https://a.example" onRawTextChange={() => {}} resetKey={0}>
        <Boom crash />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    expect(screen.getByRole('textbox')).toHaveValue('GET https://a.example');
  });

  it('saves edits made in the fallback textarea', () => {
    const onRawTextChange = vi.fn();
    render(
      <ErrorBoundary rawText="old" onRawTextChange={onRawTextChange} resetKey={0}>
        <Boom crash />
      </ErrorBoundary>
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new text' } });

    expect(onRawTextChange).toHaveBeenCalledTimes(1);
    expect(onRawTextChange).toHaveBeenCalledWith('new text');
    expect(screen.getByRole('textbox')).toHaveValue('new text');
  });

  it('shows a newer text from the host in the fallback', () => {
    const { rerender } = render(
      <ErrorBoundary rawText="first" onRawTextChange={() => {}} resetKey={0}>
        <Boom crash />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary rawText="second" onRawTextChange={() => {}} resetKey={0}>
        <Boom crash />
      </ErrorBoundary>
    );

    expect(screen.getByRole('textbox')).toHaveValue('second');
  });

  it('tries the editor again when another note is opened', () => {
    const { rerender } = render(
      <ErrorBoundary rawText="a" onRawTextChange={() => {}} resetKey={0}>
        <Boom crash />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary rawText="b" onRawTextChange={() => {}} resetKey={1}>
        <Boom crash={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('editor is fine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
