import React from 'react';
import { type HttpRequest } from '../lib/parser';
import { executeRequest } from '../lib/executor';
import { findIgnoredHeaders } from '../lib/forbiddenHeaders';
import { type HTTPError, type HTTPResponse } from '../lib/types';

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
}

/** Pretty prints JSON bodies for display; copy keeps the raw text */
function prettyPrintBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
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
    this.state = { running: false, prettyBody: null };
  }

  componentWillUnmount() {
    this.abortController?.abort();
  }

  run = () => {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.setState({ running: true, response: undefined, error: undefined, prettyBody: null });
    executeRequest(this.props.request, { signal: controller.signal }).then(
      (result) => {
        // A newer run owns the state; this stale result must not overwrite it.
        if (this.abortController !== controller) {
          return;
        }
        this.setState({
          running: false,
          response: result.response,
          error: result.error,
          prettyBody: result.response ? prettyPrintBody(result.response.body) : null,
        });
      }
    );
  };

  cancel = () => {
    this.abortController?.abort();
  };

  closeResponse = () => {
    this.setState({ running: false, response: undefined, error: undefined, prettyBody: null });
  };

  copyBody = () => {
    const { response } = this.state;
    if (response) {
      navigator.clipboard?.writeText(response.body);
    }
  };

  render() {
    const { request, active, onSelect } = this.props;
    const { running, response, error, prettyBody } = this.state;
    const ignoredHeaders = findIgnoredHeaders(request.headers);

    return (
      <div
        className={active ? 'block active' : 'block'}
        onClick={onSelect}
        role="presentation"
      >
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
          <div className="warning">
            Browsers ignore these headers: {ignoredHeaders.join(', ')}
          </div>
        )}
        {running && <div className="running">Running...</div>}
        {response && (
          <div className="response">
            <div className="response-meta">
              <span
                className={response.status < 400 ? 'status ok' : 'status err'}
              >
                {response.status}
              </span>
              <span>{response.timeMs} ms</span>
              <span>{response.sizeBytes} B</span>
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
              <summary>
                Headers ({Object.keys(response.headers).length})
              </summary>
              {Object.entries(response.headers).map(([name, value]) => (
                <div className="header-row" key={name}>
                  <span className="header-name">{name}</span>
                  {': '}
                  <span className="header-value">{value}</span>
                </div>
              ))}
            </details>
            <pre className="response-body">{prettyBody ?? response.body}</pre>
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
