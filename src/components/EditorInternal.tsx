import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { minimalSetup } from 'codemirror';
import Block from './Block';
import VariablesPanel from './VariablesPanel';
import { type EditorInternalInterface } from '../lib/types';
import { httpEditorTheme, httpHighlightExtensions } from '../lib/httpHighlight';
import { DEFAULT_SPLIT_PCT, clampSplitPct, readSplitPct, writeSplitPct } from '../lib/layout';

function EditorInternal(props: EditorInternalInterface) {
  const { rawText, httpFile, onTextChange, onInsertSample, onSetEnvironment, activeEnvironment } =
    props;
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [splitPct, setSplitPct] = useState<number>(() => readSplitPct());
  const [dragging, setDragging] = useState(false);

  // Wire the CodeMirror view once; doc contents flow through props below.
  // The activeIndex derives from the caret position so the block list can
  // highlight (and scroll to) whichever block contains the caret.
  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current as HTMLElement,
      state: EditorState.create({
        doc: rawText,
        extensions: [
          minimalSetup,
          EditorView.lineWrapping,
          httpEditorTheme(),
          ...httpHighlightExtensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onTextChange(update.state.doc.toString());
            }
            if (update.selectionSet) {
              const offset = update.state.selection.main.head;
              const line = update.state.doc.lineAt(offset).number - 1;
              let nextIndex: number | null = null;
              for (let index = 0; index < httpFile.requests.length; index++) {
                const request = httpFile.requests[index];
                const nextRequest = httpFile.requests[index + 1];
                if (
                  request.lineIndex <= line &&
                  (!nextRequest || nextRequest.lineIndex > line)
                ) {
                  nextIndex = index;
                }
              }
              setActiveIndex(nextIndex);
            }
          }),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        ],
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
    // Rebuilding once per mount; the props object identity changes every parse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor contents identical to the parsed prop so both stay in sync.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    if (view.state.doc.toString() !== rawText) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: rawText },
      });
    }
  }, [rawText]);

  return (
    <div className={dragging ? 'api-client dragging' : 'api-client'} ref={wrapperRef}>
      <div
        className="raw-editor-container"
        style={{ width: `${splitPct}%` }}
        ref={containerRef}
      />
      <div
        className="divider"
        title="Drag to resize the columns; double-click resets the width"
        onDoubleClick={() => {
          setSplitPct(DEFAULT_SPLIT_PCT);
          writeSplitPct(DEFAULT_SPLIT_PCT);
        }}
        onPointerCancel={() => setDragging(false)}
        onPointerDown={(event) => {
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          if (!dragging || !wrapperRef.current) {
            return;
          }
          const rect = wrapperRef.current.getBoundingClientRect();
          setSplitPct(clampSplitPct(((event.clientX - rect.left) / rect.width) * 100));
        }}
        onPointerUp={(event) => {
          if (!dragging) {
            return;
          }
          event.currentTarget.releasePointerCapture(event.pointerId);
          writeSplitPct(splitPct);
          setDragging(false);
        }}
      />
      <div className="requests-list">
        <VariablesPanel
          variables={httpFile.variables}
          environments={httpFile.environments}
          activeEnvironment={activeEnvironment}
          onSetEnvironment={onSetEnvironment}
        />
        {httpFile.requests.length === 0 && (
          <div className="empty">
            <p>Write an .http request to see blocks here.</p>
            <button className="insert-sample" onClick={onInsertSample}>
              Add sample
            </button>
          </div>
        )}
        {httpFile.requests.map((request, index) => (
          <Block
            key={request.lineIndex}
            request={request}
            active={activeIndex === index}
            onSelect={() => {
              const view = viewRef.current;
              if (!view) {
                return;
              }
              const line = view.state.doc.line(request.lineIndex + 1);
              view.dispatch({
                selection: { anchor: line.from },
                effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
              });
              view.focus();
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default EditorInternal;
