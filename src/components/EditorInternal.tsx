import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Annotation, EditorState, Prec, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { minimalSetup } from 'codemirror';
import Block from './Block';
import VariablesPanel from './VariablesPanel';
import { type EditorInternalInterface } from '../lib/types';
import { httpEditorTheme, httpHighlightExtensions } from '../lib/httpHighlight';
import { DEFAULT_SPLIT_PCT, clampSplitPct, readSplitPct, writeSplitPct } from '../lib/layout';

/** Marks transactions that sync the view with the prop, so they are not saved back. */
const External = Annotation.define<boolean>();

function EditorInternal(props: EditorInternalInterface) {
  const {
    rawText,
    httpFile,
    onTextChange,
    onInsertSample,
    onSetEnvironment,
    activeEnvironment,
    historyEpoch = 0,
  } = props;
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [caretLine, setCaretLine] = useState<number | null>(null);
  const [splitPct, setSplitPct] = useState<number>(() => readSplitPct());
  const [dragging, setDragging] = useState(false);
  // Block instances by index, for Mod-Enter (run the request under the
  // caret) and the Run all button.
  const blockRefs = useRef(new Map<number, InstanceType<typeof Block>>());
  const activeIndexRef = useRef<number | null>(null);

  // The listener lives as long as the view, so it reads the callback through a ref.
  const onTextChangeRef = useRef(onTextChange);
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  });

  const runRequestUnderCaret = () => {
    const index = activeIndexRef.current;
    if (index === null) {
      return false;
    }
    const block = blockRefs.current.get(index);
    if (!block) {
      return false;
    }
    void block.run();
    return true;
  };
  const runRequestUnderCaretRef = useRef(runRequestUnderCaret);
  useEffect(() => {
    runRequestUnderCaretRef.current = runRequestUnderCaret;
  });

  const buildState = useCallback(
    (doc: string) =>
      EditorState.create({
        doc,
        extensions: [
          minimalSetup,
          EditorView.lineWrapping,
          httpEditorTheme(),
          ...httpHighlightExtensions,
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) => transaction.annotation(External))
            ) {
              onTextChangeRef.current(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              const offset = update.state.selection.main.head;
              setCaretLine(update.state.doc.lineAt(offset).number - 1);
            }
          }),
          // Above defaultKeymap, which binds Mod-Enter to insertBlankLine.
          Prec.highest(
            keymap.of([{ key: 'Mod-Enter', run: () => runRequestUnderCaretRef.current() }])
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        ],
      }),
    []
  );

  // Wire the CodeMirror view once; doc contents flow through props below.
  useEffect(() => {
    const view = new EditorView({
      parent: containerRef.current as HTMLElement,
      state: buildState(rawText),
    });
    viewRef.current = view;
    return () => view.destroy();
    // Rebuilding once per mount; later text changes arrive through rawText.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor contents identical to the parsed prop so both stay in sync.
  const appliedEpoch = useRef(historyEpoch);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    if (appliedEpoch.current !== historyEpoch) {
      // A different note: start from a fresh state so undo cannot cross notes.
      appliedEpoch.current = historyEpoch;
      view.setState(buildState(rawText));
      setCaretLine(null);
      return;
    }
    if (view.state.doc.toString() !== rawText) {
      // Same note updated from outside: neither a user edit to save nor
      // something undo should revert.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: rawText },
        annotations: [External.of(true), Transaction.addToHistory.of(false)],
      });
    }
  }, [rawText, historyEpoch, buildState]);

  // The block under the caret, derived so it follows the latest parse; the
  // view listener only knows the caret line.
  const activeIndex = useMemo(() => {
    if (caretLine === null) {
      return null;
    }
    let nextIndex: number | null = null;
    for (let index = 0; index < httpFile.requests.length; index++) {
      const request = httpFile.requests[index];
      const nextRequest = httpFile.requests[index + 1];
      if (request.lineIndex <= caretLine && (!nextRequest || nextRequest.lineIndex > caretLine)) {
        nextIndex = index;
      }
    }
    return nextIndex;
  }, [httpFile.requests, caretLine]);

  // The keymap is wired once with the view, so it reads the active index
  // through a ref.
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Keyed by title and repeat count, not by line: adding lines above a block
  // must not remount it and drop the response it is showing.
  const blockKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return httpFile.requests.map((request) => {
      const ordinal = seen.get(request.title) ?? 0;
      seen.set(request.title, ordinal + 1);
      return `${request.title}#${ordinal}`;
    });
  }, [httpFile.requests]);

  // Labels of the requests in this file, so a {{label.response.*}} reference
  // is not warned about as an unresolved variable.
  const requestNames = useMemo(
    () =>
      new Set(
        httpFile.requests.map((request) => request.name).filter((name) => name !== undefined)
      ),
    [httpFile.requests]
  );

  return (
    <div className={dragging ? 'api-client dragging' : 'api-client'} ref={wrapperRef}>
      <div
        className="raw-editor-container"
        // A custom property, not a width, so the narrow layout can override it.
        style={{ '--editor-width': `${splitPct}%` } as React.CSSProperties}
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
            key={blockKeys[index]}
            ref={(block: InstanceType<typeof Block> | null) => {
              if (block) {
                blockRefs.current.set(index, block);
              } else {
                blockRefs.current.delete(index);
              }
            }}
            request={request}
            active={activeIndex === index}
            requestNames={requestNames}
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
