import React from 'react';
import Block from './Block';
import { type EditorInternalInterface } from '../lib/types';

/**
 * Renders the note as an editable text area plus a sidebar listing the
 * parsed request blocks. v0.1 keeps editing as plain text; the block list
 * is the "Run" surface.
 */
function EditorInternal(props: EditorInternalInterface) {
  const { rawText, httpFile, onTextChange, onInsertSample } = props;

  return (
    <div className="api-client">
      <div className="requests-list">
        {httpFile.requests.length === 0 && (
          <div className="empty">
            <p>Write an .http request to see blocks here.</p>
            <button className="insert-sample" onClick={onInsertSample}>
              Add sample
            </button>
          </div>
        )}
        {httpFile.requests.map((request) => (
          <Block key={request.lineIndex} request={request} />
        ))}
      </div>
      <textarea
        className="raw-editor"
        value={rawText}
        onChange={(event) => onTextChange(event.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

export default EditorInternal;
