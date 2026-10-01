import React from 'react';
import EditorKit from '@standardnotes/editor-kit';
import { type EditorKitDelegate } from '@standardnotes/editor-kit';
import { SAMPLE_HTTP_TEXT } from '../lib/sampleHttp';
import { setActiveEnvironment } from '../lib/parser';
import { HttpFile } from '../lib/parser';
import { parseHttpFile } from '../lib/parser';
import './Editor.css';
import EditorInternal from './EditorInternal';

const initialText = SAMPLE_HTTP_TEXT;

interface EditorInterface {
  httpFile: HttpFile | null;
  rawText: string;
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
    // Start with pristine text as a placeholder; once the note is ready,
    // setEditorRawText overwrites this with the actual note content.
    this.state = { httpFile: parseHttpFile(initialText), rawText: initialText };
  }

  configureEditorKit = () => {
    const delegate: EditorKitDelegate = {
      setEditorRawText: (text: string) => {
        const httpFile = parseHttpFile(text);
        this.setState({ rawText: text, httpFile });
      },
      clearUndoHistory: () => {},
      handleRequestForContentHeight: () => undefined,
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
    return (
      <EditorInternal
        rawText={this.state.rawText}
        httpFile={this.state.httpFile}
        onTextChange={this.handleTextChange}
        onInsertSample={this.handleInsertSample}
        onSetEnvironment={this.handleSetEnvironment}
        activeEnvironment={this.state.httpFile.environment}
      />
    );
  }
}
