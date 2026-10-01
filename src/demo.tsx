import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@standardnotes/stylekit/dist/stylekit.css';
import './stylesheets/main.scss';
import './components/Editor.css';
import './demo.css';
import EditorInternal from './components/EditorInternal';
import { parseHttpFile, setActiveEnvironment } from './lib/parser';
import { DEMO_TEMPLATES, DEFAULT_TEMPLATE_NAME } from './lib/demoTemplates';
import { SAMPLE_HTTP_TEXT } from './lib/sampleHttp';

const STORAGE_KEY = 'standardnotes-apiclient-demo-text';

/** Sandbox edition: same UI as the plugin, with localStorage in place of
 * the note (the EditorKit bridge needs the app context to talk to). */
function DemoEditor() {
  const stored = (() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const [rawText, setRawText] = useState<string>(stored ?? SAMPLE_HTTP_TEXT);
  const [templateName, setTemplateName] = useState<string>(DEFAULT_TEMPLATE_NAME);

  const onTextChange = (nextText: string) => {
    setRawText(nextText);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextText);
    } catch (error) {
      console.log('Could not persist demo text:', error);
    }
  };

  const loadTemplate = (name: string) => {
    const template = DEMO_TEMPLATES.find((item) => item.name === name);
    const nextText = template?.text ?? SAMPLE_HTTP_TEXT;
    setTemplateName(name);
    onTextChange(nextText);
  };

  const reset = () => {
    loadTemplate(DEFAULT_TEMPLATE_NAME);
  };

  const httpFile = parseHttpFile(rawText);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>StandardNotes API Client</h1>
        <p>
          Live sandbox of the plugin. Here it runs outside Standard Notes and
          keeps the note text in your browser&apos;s localStorage; inside the app
          the same editor saves the text (E2EE) on the note itself. Only CORS
          enabled endpoints answer requests made from this page, like
          httpbin.org and jsonplaceholder.
        </p>
        <label className="template-row">
          Sample scenarios:
          <select value={templateName} onChange={(event) => loadTemplate(event.target.value)}>
            {DEMO_TEMPLATES.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>
          <button className="reset" onClick={reset} title="Reload the current scenario">
            Reload
          </button>
        </label>
      </header>
      <main className="demo-main">
        <EditorInternal
          rawText={rawText}
          httpFile={httpFile}
          onTextChange={onTextChange}
          onInsertSample={reset}
          onSetEnvironment={(environment) =>
            onTextChange(setActiveEnvironment(rawText, environment))
          }
          activeEnvironment={httpFile.environment}
        />
      </main>
      <footer className="demo-footer">
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
            <a href="https://standardnotes.com" target="_blank" rel="noreferrer">
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
