import React, { useState } from 'react';

interface ErrorBoundaryProps {
  /** Raw note text, shown for rescue editing when the editor cannot render */
  rawText: string;
  /** Saves edits made in the fallback textarea */
  onRawTextChange: (text: string) => void;
  /** Changes when another note is opened, which retries the editor */
  resetKey: number;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

interface FallbackProps {
  error: Error;
  rawText: string;
  onRawTextChange: (text: string) => void;
}

/** Plain text view of the note, so a crash never leaves it out of reach. */
function RawTextFallback({ error, rawText, onRawTextChange }: FallbackProps) {
  const [text, setText] = useState(rawText);
  const [seenRawText, setSeenRawText] = useState(rawText);

  // A newer text from the host replaces what is shown, adjusted during render
  // instead of in an effect so the textarea never paints the stale text.
  if (rawText !== seenRawText) {
    setSeenRawText(rawText);
    setText(rawText);
  }

  return (
    <div className="error-fallback" role="alert">
      <p>
        The editor could not be displayed ({error.message}). Your note is shown as plain text and
        edits are still saved.
      </p>
      <textarea
        value={text}
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
          onRawTextChange(event.target.value);
        }}
      />
    </div>
  );
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Editor failed to render:', error);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <RawTextFallback
          error={error}
          rawText={this.props.rawText}
          onRawTextChange={this.props.onRawTextChange}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
