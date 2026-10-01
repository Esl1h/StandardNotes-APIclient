/**
 * Parser for the .http/.rest file format used by VS Code REST Client and
 * kulala.nvim. Supports:
 * - Variables: @name = value (file-scoped, may reference earlier variables)
 * - Request blocks separated by ### Title lines
 * - Request line: METHOD URL (or URL alone, method defaults to GET)
 * - Headers: Name: value (only between request line and first blank line)
 * - Body: lines after the first blank line of the block, taken verbatim
 * - Comments (#) outside request bodies
 * - Interpolation of {{variable}} in urls, headers, bodies and variables
 */

interface HttpRequest {
  /** Title from the ### separator line, or a fallback label */
  title: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  /** Zero-based line index of the request line within the file */
  lineIndex: number;
}

interface HttpVariable {
  name: string;
  value: string;
  lineIndex: number;
}

interface HttpFile {
  variables: HttpVariable[];
  requests: HttpRequest[];
}

const REQUEST_LINE = /^([A-Za-z]+)\s+(\S+)$/;
const URL_ONLY_LINE = /^(https?:\/\/\S+)$/;
const VARIABLE_LINE = /^@([A-Za-z0-9_-]+)\s*=\s*(.*)$/;
const HEADER_LINE = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/;

function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, name: string) => {
    return Object.hasOwn(variables, name) ? variables[name] : match;
  });
}

/**
 * Parses raw note text into variables and request blocks. Never throws:
 * malformed lines are ignored so that the editor always renders something.
 */
function parseHttpFile(text: string): HttpFile {
  const lines = text.split('\n');
  const variables: HttpVariable[] = [];
  const requests: HttpRequest[] = [];

  let currentTitle = '';
  let currentRequest: HttpRequest | null = null;
  let sawHeaderOrRequest = false;
  let bodyLines: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const separatorMatch = line.match(/^###\s*(.*)$/);
    if (separatorMatch) {
      if (currentRequest && bodyLines && bodyLines.length > 0) {
        currentRequest.body = bodyLines.join('\n');
      }
      currentTitle = separatorMatch[1].trim();
      currentRequest = null;
      bodyLines = null;
      sawHeaderOrRequest = false;
      continue;
    }

    // Once inside a body, take every line verbatim (even blanks and '#').
    if (currentRequest && bodyLines) {
      bodyLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '') {
      // A blank line after a request line or headers starts the body.
      if (currentRequest && sawHeaderOrRequest && !bodyLines) {
        bodyLines = [];
      }
      continue;
    }

    // Comment lines are only meaningful outside a request body.
    if (trimmed.startsWith('#')) {
      continue;
    }

    const variableMatch = line.match(VARIABLE_LINE);
    if (variableMatch) {
      variables.push({
        name: variableMatch[1],
        value: variableMatch[2].trim(),
        lineIndex: i,
      });
      continue;
    }

    if (!currentRequest) {
      const requestMatch = trimmed.match(REQUEST_LINE);
      const urlOnlyMatch = trimmed.match(URL_ONLY_LINE);
      if (requestMatch || urlOnlyMatch) {
        const method = requestMatch ? requestMatch[1].toUpperCase() : 'GET';
        const url = requestMatch ? requestMatch[2] : urlOnlyMatch[1];
        currentRequest = {
          title: currentTitle || url,
          method,
          url,
          headers: {},
          lineIndex: i,
        };
        requests.push(currentRequest);
        sawHeaderOrRequest = true;
        bodyLines = null;
      }
      continue;
    }

    const headerMatch = trimmed.match(HEADER_LINE);
    if (headerMatch) {
      currentRequest.headers[headerMatch[1]] = headerMatch[2].trim();
      sawHeaderOrRequest = true;
    } else {
      // Unrecognized content after headers without a blank separator:
      // treat it as the start of the body so nothing is silently dropped.
      bodyLines = [line];
    }
  }

  if (currentRequest && bodyLines && bodyLines.length > 0) {
    currentRequest.body = bodyLines.join('\n');
  }

  // Interpolate variables in declaration order so values can reference
  // variables defined earlier in the file.
  const variableMap: Record<string, string> = {};
  for (const variable of variables) {
    variableMap[variable.name] = interpolate(variable.value, variableMap);
  }
  for (const variable of variables) {
    variable.value = variableMap[variable.name];
  }

  for (const request of requests) {
    request.url = interpolate(request.url, variableMap);
    for (const name of Object.keys(request.headers)) {
      request.headers[name] = interpolate(request.headers[name], variableMap);
    }
    if (request.body !== undefined) {
      request.body = interpolate(request.body, variableMap);
    }
  }

  return { variables, requests };
}

export type { HttpFile, HttpRequest, HttpVariable };
export { parseHttpFile, interpolate };
