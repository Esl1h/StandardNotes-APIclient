import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@standardnotes/stylekit/dist/stylekit.css';
import './stylesheets/main.scss';
import './components/Editor.css';
import './demo.css';
import EditorInternal from './components/EditorInternal';
import { parseHttpFile } from './lib/parser';
import { SAMPLE_HTTP_TEXT } from './lib/sampleHttp';

const STORAGE_KEY = 'standardnotes-apiclient-demo-text';

/** Sandbox edition: same UI as the plugin, with localStorage in place of
 * the note (the EditorKit bridge needs the app context to talk to). */
function DemoEditor() {
  const [rawText, setRawText] = useState<string>(() => {
    return window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE_HTTP_TEXT;
  });

  const onTextChange = (nextText: string) => {
    setRawText(nextText);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextText);
    } catch (error) {
      console.log('Could not persist demo text:', error);
    }
  };

  const reset = () => {
    setRawText(SAMPLE_HTTP_TEXT);
    try {
      window.localStorage.setItem(STORAGE_KEY, SAMPLE_HTTP_TEXT);
    } catch (error) {
      console.log('Could not persist demo text:', error);
    }
  };

  const httpFile = parseHttpFile(rawText);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>StandardNotes API Client</h1>
        <p>
          Live sandbox of the plugin. Here it runs outside Standard Notes and
          keeps the note text in your browser&apos;s localStorage; inside the
          app the same editor saves the text (E2EE) on the note itself. Only
          CORS enabled endpoints answer requests made from this page, like
          httpbin.org and jsonplaceholder.
        </p>
      </header>
      <main className="demo-main">
        <EditorInternal
          rawText={rawText}
          httpFile={httpFile}
          onTextChange={onTextChange}
          onInsertSample={reset}
        />
      </main>
      <footer className="demo-footer">
        <button
          className="reset"
          onClick={reset}
          title="Restore the sample .http content"
        >
          Reset demo
        </button>
        <ul>
          <li>
            <a
              href="https://github.com/Esl1h/StandardNotes-APIclient"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
          </li>
          <li>
            <a
              href="https://standardnotes.com"
              target="_blank"
              rel="noreferrer"
            >
              Standard Notes
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}

const rootElement = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootElement).render(
  <React.Fragment>
    <DemoEditor />
  </React.Fragment>
);
