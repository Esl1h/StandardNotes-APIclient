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
}

interface EditorInternalInterface {
  rawText: string;
  httpFile: HttpFile;
  onTextChange: (rawText: string) => void;
  onInsertSample: () => void;
}

export type { HTTPResponse, HTTPError, EditorInternalInterface };
