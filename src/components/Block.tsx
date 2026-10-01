import React from 'react';
import { type HttpRequest } from '../lib/parser';
import { executeRequest } from '../lib/executor';
import { type HTTPError, type HTTPResponse } from '../lib/types';

interface BlockProperties {
  request: HttpRequest;
}

interface BlockDriverState {
  running: boolean;
  response?: HTTPResponse;
  error?: HTTPError;
}

/**
 * One .http request block: summary line, Run button and inline response
 * (volatile; never written back to the note text).
 */
class Block extends React.Component<BlockProperties, BlockDriverState> {
  abortController?: AbortController;

  constructor(props: BlockProperties) {
    super(props);
    this.state = { running: false };
  }

  componentWillUnmount() {
    this.abortController?.abort();
  }

  run = () => {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.setState({ running: true, response: undefined, error: undefined });
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
        });
      }
    );
  };

  cancel = () => {
    this.abortController?.abort();
  };

  closeResponse = () => {
    this.setState({ running: false, response: undefined, error: undefined });
  };

  render() {
    const { request } = this.props;
    const { running, response, error } = this.state;

    return (
      <div className="block">
        <div className="block-summary">
          {running ? (
            <button
              className="cancel"
              onClick={this.cancel}
              title="Cancel request"
            >
              Cancel
            </button>
          ) : (
            <button className="run" onClick={this.run} title="Run request">
              Run
            </button>
          )}
          <span className="method">{request.method}</span>
          <span className="url" title={request.url}>
            {request.url}
          </span>
        </div>
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
                className="close"
                onClick={this.closeResponse}
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
            <pre className="response-body">{response.body}</pre>
          </div>
        )}
        {error && (
          <div className="error">
            Request failed ({error.kind}): {error.message}
          </div>
        )}
      </div>
    );
  }
}

export default Block;
