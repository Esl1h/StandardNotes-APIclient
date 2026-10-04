import React from 'react';
import { type HttpRequest } from '../lib/parser';
import { executeRequest } from '../lib/executor';
import { findIgnoredHeaders } from '../lib/forbiddenHeaders';
import { prettyPrintBody } from '../lib/prettyPrint';
import { type HTTPError, type HTTPResponse } from '../lib/types';

/** Characters of a response body rendered before "Show all"; the DOM of a
 * multi-megabyte <pre> freezes a WebView. */
const DISPLAY_LIMIT = 200_000;

interface BlockProperties {
  request: HttpRequest;
  /** True while the caret inside the source sits on this request */
  active: boolean;
  /** Click scroll-to-source callback (moves the editor caret here) */
  onSelect: () => void;
}

interface BlockDriverState {
  running: boolean;
  response?: HTTPResponse;
  error?: HTTPError;
  /** Formatted (pretty printed) body; null when the body is not JSON */
  prettyBody: string | null;
  /** Object URL of a binary response, for the preview and the download link */
  binaryUrl: string | null;
  /** True once the user asked for a body longer than DISPLAY_LIMIT in full */
  showFullBody: boolean;
}

/** File name for a downloaded response: the last path segment of the url */
function downloadName(url: string): string {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'response';
  } catch {
    return 'response';
  }
}

/**
 * One .http request block: summary line, Run button and inline response
 * (volatile; never written back to the note text); clicking the block
 * scrolls the source editor to the request line.
 */
class Block extends React.Component<BlockProperties, BlockDriverState> {
  abortController?: AbortController;

  constructor(props: BlockProperties) {
    super(props);
    this.state = { running: false, prettyBody: null, binaryUrl: null, showFullBody: false };
  }

  componentWillUnmount() {
    this.abortController?.abort();
    this.releaseBinaryUrl();
  }

  releaseBinaryUrl() {
    if (this.state.binaryUrl) {
      URL.revokeObjectURL(this.state.binaryUrl);
    }
  }

  run = () => {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.releaseBinaryUrl();
    this.setState({
      running: true,
      response: undefined,
      error: undefined,
      prettyBody: null,
      binaryUrl: null,
      showFullBody: false,
    });
    executeRequest(this.props.request, { signal: controller.signal }).then((result) => {
      // A newer run owns the state; this stale result must not overwrite it.
      if (this.abortController !== controller) {
        return;
      }
      this.setState({
        running: false,
        response: result.response,
        error: result.error,
        prettyBody: result.response ? prettyPrintBody(result.response.body) : null,
        binaryUrl: result.response?.binary
          ? URL.createObjectURL(result.response.binary.blob)
          : null,
      });
    });
  };

  cancel = () => {
    this.abortController?.abort();
  };

  closeResponse = () => {
    this.releaseBinaryUrl();
    this.setState({
      running: false,
      response: undefined,
      error: undefined,
      prettyBody: null,
      binaryUrl: null,
      showFullBody: false,
    });
  };

  copyBody = () => {
    const { response } = this.state;
    if (response) {
      navigator.clipboard?.writeText(response.body);
    }
  };

  render() {
    const { request, active, onSelect } = this.props;
    const { running, response, error, prettyBody, binaryUrl, showFullBody } = this.state;
    const ignoredHeaders = findIgnoredHeaders(request.headers);
    const bodyText = prettyBody ?? response?.body ?? '';
    const bodyCapped = bodyText.length > DISPLAY_LIMIT && !showFullBody;

    return (
      <div className={active ? 'block active' : 'block'} onClick={onSelect} role="presentation">
        <div className="block-summary">
          {running ? (
            <button
              className="cancel"
              onClick={(event) => {
                event.stopPropagation();
                this.cancel();
              }}
              title="Cancel request"
            >
              Cancel
            </button>
          ) : (
            <button
              className="run"
              onClick={(event) => {
                event.stopPropagation();
                this.run();
              }}
              title="Run request"
            >
              Run
            </button>
          )}
          <span className="method">{request.method}</span>
          <span className="url" title={request.url}>
            {request.url}
          </span>
        </div>
        {ignoredHeaders.length > 0 && (
          <div className="warning">Browsers ignore these headers: {ignoredHeaders.join(', ')}</div>
        )}
        {running && <div className="running">Running...</div>}
        {response && (
          <div className="response">
            <div className="response-meta">
              <span className={response.status < 400 ? 'status ok' : 'status err'}>
                {response.status}
              </span>
              <span>{response.timeMs} ms</span>
              <span
                title={
                  response.sizeIsDecoded
                    ? 'Size of the decoded body; the server did not report content-length'
                    : 'Size reported by the content-length header'
                }
              >
                {response.sizeBytes} B{response.sizeIsDecoded ? ' (decoded)' : ''}
              </span>
              {!response.binary && (
                <button
                  className="copy-body"
                  onClick={(event) => {
                    event.stopPropagation();
                    this.copyBody();
                  }}
                  title="Copy the raw response body (exactly as received)"
                >
                  Copy body
                </button>
              )}
              <button
                className="close"
                onClick={(event) => {
                  event.stopPropagation();
                  this.closeResponse();
                }}
                title="Close response"
              >
                ×
              </button>
            </div>
            <details className="response-headers">
              <summary>Headers ({Object.keys(response.headers).length})</summary>
              {Object.entries(response.headers).map(([name, value]) => (
                <div className="header-row" key={name}>
                  <span className="header-name">{name}</span>
                  {': '}
                  <span className="header-value">{value}</span>
                </div>
              ))}
            </details>
            {response.binary ? (
              <div className="binary-response">
                {binaryUrl && response.binary.contentType.startsWith('image/') && (
                  <img src={binaryUrl} alt="Response preview" />
                )}
                {binaryUrl && (
                  <a
                    href={binaryUrl}
                    download={downloadName(request.url)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Download ({response.binary.contentType}, {response.sizeBytes} B)
                  </a>
                )}
              </div>
            ) : (
              <>
                <pre className="response-body">
                  {bodyCapped ? bodyText.slice(0, DISPLAY_LIMIT) : bodyText}
                </pre>
                {bodyCapped && (
                  <button
                    className="show-all"
                    onClick={(event) => {
                      event.stopPropagation();
                      this.setState({ showFullBody: true });
                    }}
                    title="Render the rest of the body; large ones can slow the editor down"
                  >
                    Show all ({Math.round(bodyText.length / 1024)} KB)
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {error && (
          <div className="error">
            Request failed ({error.kind}): {error.message}
            {error.hint && <div className="error-hint">{error.hint}</div>}
          </div>
        )}
      </div>
    );
  }
}

export default Block;
