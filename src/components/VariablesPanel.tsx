import React, { useState } from 'react';
import { type HttpVariable } from '../lib/parser';

interface VariablesPanelInterface {
  variables: HttpVariable[];
  environments: string[];
  activeEnvironment: string | null;
  onSetEnvironment: (environment: string | null) => void;
}

/** Sidebar section listing the file variables (with copy buttons) and the
 * environment chips used to switch the @env declaration in the text. */
function VariablesPanel(props: VariablesPanelInterface) {
  const { variables, environments, activeEnvironment, onSetEnvironment } = props;
  const [copied, setCopied] = useState<string | null>(null);

  if (variables.length === 0) {
    return null;
  }

  const copy = (variable: HttpVariable) => {
    const fullKey = variable.env ? `${variable.name}.${variable.env}` : variable.name;
    navigator.clipboard?.writeText(variable.value);
    setCopied(fullKey);
    setTimeout(() => setCopied(null), 1500);
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
          return (
            <li key={fullKey} className="variable-row">
              <span className="variable-name">{fullKey}</span>
              <span className="variable-value">{variable.value}</span>
              <button
                className="copy"
                onClick={() => copy(variable)}
                title={`Copy the value of ${fullKey}`}
              >
                {copied === fullKey ? 'copied' : 'copy'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default VariablesPanel;
