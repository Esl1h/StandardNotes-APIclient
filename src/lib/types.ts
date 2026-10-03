import { type HttpFile } from './parser';

interface HTTPResponse {
  status: number;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
}

interface HTTPError {
  kind: 'network' | 'timeout' | 'aborted';
  message: string;
  /** Likely cause and what to do about it, when one is known */
  hint?: string;
}

interface EditorInternalInterface {
  rawText: string;
  httpFile: HttpFile;
  onTextChange: (rawText: string) => void;
  onInsertSample: () => void;
  onSetEnvironment: (environment: string | null) => void;
  activeEnvironment: string | null;
  /** Bump when rawText is a different document, to reset the undo history */
  historyEpoch?: number;
}

export type { HTTPResponse, HTTPError, EditorInternalInterface };
