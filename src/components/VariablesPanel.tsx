import React, { useState } from 'react';
import { type HttpVariable } from '../lib/parser';
import { COPY_FEEDBACK_MS, copyText } from '../lib/clipboard';

interface VariablesPanelInterface {
  variables: HttpVariable[];
  environments: string[];
  activeEnvironment: string | null;
  onSetEnvironment: (environment: string | null) => void;
}

// Names that usually hold credentials. Their values are masked until revealed,
// since the panel shows resolved values and sits on screen next to the note.
const SECRET_NAME = /token|secret|key|pass(?:word|wd)|auth/i;
// A fixed width, so the mask does not leak the length of the value.
const MASK = '••••••••';

/** Sidebar section listing the file variables (with copy buttons) and the
 * environment chips used to switch the @env declaration in the text. */
function VariablesPanel(props: VariablesPanelInterface) {
  const { variables, environments, activeEnvironment, onSetEnvironment } = props;
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  if (variables.length === 0) {
    return null;
  }

  // A variable can be redefined; the line tells the rows apart.
  const rowKey = (variable: HttpVariable) =>
    `${variable.env ? `${variable.name}.${variable.env}` : variable.name}:${variable.lineIndex}`;

  const toggleReveal = (key: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };

  const copy = async (variable: HttpVariable) => {
    const ok = await copyText(variable.value);
    setCopied({ key: rowKey(variable), ok });
    setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
  };

  return (
    <div className="variables-panel">
      {environments.length > 0 && (
        <div className="environment-row">
          <button
            className={activeEnvironment === null ? 'chip active' : 'chip'}
            onClick={() => onSetEnvironment(null)}
            title="Use the default (unsuffixed) variable values"
          >
            default
          </button>
          {environments.map((environment) => (
            <button
              key={environment}
              className={activeEnvironment === environment ? 'chip active' : 'chip'}
              onClick={() => onSetEnvironment(environment)}
              title={`Use the ${environment} environment values`}
            >
              {environment}
            </button>
          ))}
        </div>
      )}
      <ul>
        {variables.map((variable) => {
          const fullKey = variable.env ? `${variable.name}.${variable.env}` : variable.name;
          const key = rowKey(variable);
          const secret = SECRET_NAME.test(variable.name);
          const masked = secret && !revealed.has(key);
          return (
            <li key={key} className="variable-row">
              <span className="variable-name">{fullKey}</span>
              <span className="variable-value">{masked ? MASK : variable.value}</span>
              {secret && (
                <button
                  className="reveal"
                  onClick={() => toggleReveal(key)}
                  title={`${masked ? 'Show' : 'Hide'} the value of ${fullKey}`}
                >
                  {masked ? 'show' : 'hide'}
                </button>
              )}
              <button
                className="copy"
                onClick={() => void copy(variable)}
                title={`Copy the value of ${fullKey}`}
              >
                {copied?.key !== key ? 'copy' : copied.ok ? 'copied' : 'copy failed'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default VariablesPanel;
