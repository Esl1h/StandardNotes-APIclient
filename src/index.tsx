import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.scss';
import Editor from './components/Editor';
import './stylesheets/main.scss';

const rootElement = document.getElementById('root') as HTMLElement;
ReactDOM.createRoot(rootElement).render(
  <React.Fragment>
    <Editor />
  </React.Fragment>
);
