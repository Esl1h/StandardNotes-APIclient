import React from 'react';
import EditorKit from '@standardnotes/editor-kit';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import { SAMPLE_HTTP_TEXT } from '../lib/sampleHttp';
import { setActiveEnvironment } from '../lib/parser';
import { HttpFile } from '../lib/parser';
import { parseHttpFile } from '../lib/parser';
import { httpPreview } from '../lib/preview';
import './Editor.css';
import EditorInternal from './EditorInternal';
import ErrorBoundary from './ErrorBoundary';

/** How long to wait for Standard Notes to stream the note before saying so */
const NOTE_WAIT_MS = 5000;

interface EditorInterface {
  httpFile: HttpFile | null;
  rawText: string;
  /** Bumped on every note switch; resets the editor's undo history */
  historyEpoch: number;
  /** True once Standard Notes has streamed the note in */
  noteReceived: boolean;
  /** True when no note arrived within NOTE_WAIT_MS */
  waitTimedOut: boolean;
}

export default class Editor extends React.Component<
  Record<string, never>,
  EditorInterface
> {
  // Only the save entry point is used; tests stub this field.
  editorKit: Pick<EditorKit, 'onEditorValueChanged'>;

  constructor(props: Record<string, never>) {
    super(props);
    this.configureEditorKit();
    // Nothing is rendered until setEditorRawText delivers the note: an
    // editable placeholder would swallow typing that EditorKit drops.
    this.state = {
      httpFile: parseHttpFile(''),
      rawText: '',
      historyEpoch: 0,
      noteReceived: false,
      waitTimedOut: false,
    };
  }

  waitTimer?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    this.waitTimer = setTimeout(() => this.setState({ waitTimedOut: true }), NOTE_WAIT_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.waitTimer);
  }

  configureEditorKit = () => {
    const delegate: EditorKitDelegate = {
      setEditorRawText: (text: string) => {
        const httpFile = parseHttpFile(text);
        this.setState({ rawText: text, httpFile, noteReceived: true });
      },
      // EditorKit calls this after setEditorRawText when the note changed.
      clearUndoHistory: () => {
        this.setState(({ historyEpoch }) => ({ historyEpoch: historyEpoch + 1 }));
      },
      handleRequestForContentHeight: () => undefined,
      generateCustomPreview: (text: string) => ({ plain: httpPreview(text) }),
    };

    this.editorKit = new EditorKit(delegate, {
      mode: 'plaintext',
      coallesedSaving: true,
      coallesedSavingDelay: 350,
    });
  };

  handleTextChange = (rawText: string) => {
    const httpFile = parseHttpFile(rawText);
    this.setState({ rawText, httpFile });
    this.saveNote(rawText);
  };

  saveNote = (text: string) => {
    /** This will work in an SN context, but breaks the standalone editor,
     * so we need to catch the error
     */
    try {
      this.editorKit.onEditorValueChanged(text);
    } catch (error) {
      console.log('Error saving note:', error);
    }
  };

  handleInsertSample = () => {
    this.handleTextChange(SAMPLE_HTTP_TEXT);
  };

  handleSetEnvironment = (environment: string | null) => {
    this.handleTextChange(setActiveEnvironment(this.state.rawText, environment));
  };

  render() {
    if (!this.state.noteReceived) {
      return (
        <div className="note-status" role="status">
          {this.state.waitTimedOut
            ? 'The note was not received from Standard Notes. Close and reopen it, or restart the app.'
            : 'Waiting for the note...'}
        </div>
      );
    }
    return (
      <ErrorBoundary
        rawText={this.state.rawText}
        onRawTextChange={this.saveNote}
        resetKey={this.state.historyEpoch}
      >
        <EditorInternal
          rawText={this.state.rawText}
          httpFile={this.state.httpFile}
          onTextChange={this.handleTextChange}
          onInsertSample={this.handleInsertSample}
          onSetEnvironment={this.handleSetEnvironment}
          activeEnvironment={this.state.httpFile.environment}
          historyEpoch={this.state.historyEpoch}
        />
      </ErrorBoundary>
    );
  }
}
