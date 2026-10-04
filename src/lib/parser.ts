/**
 * Parser for the .http/.rest file format used by VS Code REST Client and
 * kulala.nvim, extended with file-internal environments. Supports:
 * - Request blocks separated by ### Title lines
 * - Request line: METHOD URL [HTTP/x.y] (or URL alone, starting with http(s)://
 *   or a {{variable}}; the method defaults to GET)
 * - Query string continuation: lines starting with ? or & right after the
 *   request line are appended to the url
 * - Headers: Name: value (only between request line and first blank line)
 * - Body: lines after the first blank line of the block, taken verbatim
 * - Comments (# and //) outside request bodies
 * - Variables: @name = value (default scope) and @name.env = value, both
 *   may reference earlier variables
 * - Active environment declaration: @env = <environment>
 * - Interpolation of {{variable}} and {{variable.env}} in urls, headers,
 *   bodies and variables
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
  /** Environment the value applies to; undefined for the default scope */
  env?: string;
  value: string;
  lineIndex: number;
}

interface HttpFile {
  variables: HttpVariable[];
  requests: HttpRequest[];
  /** Unique environment names found in variable suffixes */
  environments: string[];
  /** Value of the @env declaration, if present */
  environment: string | null;
}

// The trailing HTTP version is part of the REST Client and kulala syntax.
const REQUEST_LINE = /^([A-Za-z]+)\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/;
const URL_ONLY_LINE = /^(https?:\/\/\S+|\{\{[^}]*\}\}\S*)(?:\s+HTTP\/[\d.]+)?$/;
const QUERY_CONTINUATION = /^[?&]/;
const VARIABLE_LINE = /^@([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?\s*=\s*(.*)$/;
const HEADER_LINE = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/;
const VARIABLE_REF = /\{\{\s*([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)\s*\}\}/g;
const ENV_DECLARATION_LINE = /^@env(?:\s*=\s*([A-Za-z0-9_-]+))?\s*$/m;

type VariableLookup = (ref: string) => string | undefined;

interface VariableScopes {
  base: Map<string, string>;
  byEnvironment: Map<string, Map<string, string>>;
}

/** Groups the declared variables by scope; the last declaration of a name wins. */
function buildScopes(variables: HttpVariable[]): VariableScopes {
  const base = new Map<string, string>();
  const byEnvironment = new Map<string, Map<string, string>>();

  for (const variable of variables) {
    if (variable.env === undefined) {
      base.set(variable.name, variable.value);
    } else {
      let map = byEnvironment.get(variable.env);
      if (!map) {
        map = new Map();
        byEnvironment.set(variable.env, map);
      }
      map.set(variable.name, variable.value);
    }
  }

  return { base, byEnvironment };
}

function interpolate(text: string, lookup: VariableLookup): string {
  return text.replace(VARIABLE_REF, (match, ref: string) => {
    return lookup(ref) ?? match;
  });
}

/**
 * Resolves variable values, so they can reference other variables in any
 * order, then writes the effective values back into the variables array
 * (for display) and returns the request lookup honoring the active
 * environment.
 */
function resolveVariables(
  variables: HttpVariable[],
  activeEnvironment: string | null
): VariableLookup {
  const { base: rawBase, byEnvironment: rawByEnvironment } = buildScopes(variables);

  // Expands `ref` as seen from `context` (an environment, or null for the
  // default scope). `seen` holds the scope-qualified names on the current
  // path: meeting one again is a cycle, left as literal {{ref}} text.
  const resolve = (
    context: string | null,
    ref: string,
    seen: ReadonlySet<string>
  ): string | undefined => {
    const dot = ref.indexOf('.');
    const name = dot > -1 ? ref.slice(0, dot) : ref;
    const scope = dot > -1 ? ref.slice(dot + 1) : context;
    const scoped = scope === null ? undefined : rawByEnvironment.get(scope)?.get(name);
    // Only a bare name falls back to the default scope.
    const raw = scoped ?? (dot > -1 ? undefined : rawBase.get(name));
    if (raw === undefined) {
      return undefined;
    }
    const key = scoped === undefined ? name : `${name}.${scope}`;
    if (seen.has(key)) {
      return undefined;
    }
    const path = new Set(seen).add(key);
    const nextContext = scoped === undefined ? null : scope;
    return interpolate(raw, (inner) => resolve(nextContext, inner, path));
  };

  const base = new Map<string, string>();
  for (const [name, raw] of rawBase) {
    base.set(name, resolve(null, name, new Set()) ?? raw);
  }
  const byEnvironment = new Map<string, Map<string, string>>();
  for (const [environment, rawMap] of rawByEnvironment) {
    const resolved = new Map<string, string>();
    for (const [name, raw] of rawMap) {
      resolved.set(name, resolve(environment, `${name}.${environment}`, new Set()) ?? raw);
    }
    byEnvironment.set(environment, resolved);
  }

  // Write back the effective values so the sidebar shows resolved text.
  for (const variable of variables) {
    if (variable.env === undefined) {
      variable.value = base.get(variable.name) ?? variable.value;
    } else {
      variable.value = byEnvironment.get(variable.env)?.get(variable.name) ?? variable.value;
    }
  }

  const lookup: VariableLookup = (ref: string) => {
    const dot = ref.indexOf('.');
    if (dot > -1) {
      return byEnvironment.get(ref.slice(dot + 1))?.get(ref.slice(0, dot));
    }
    if (activeEnvironment) {
      const environmentValue = byEnvironment.get(activeEnvironment)?.get(ref);
      if (environmentValue !== undefined) {
        return environmentValue;
      }
    }
    return base.get(ref);
  };

  return lookup;
}

/** Reads the active environment from the @env declaration line */
function readActiveEnvironment(text: string): string | null {
  const match = text.match(ENV_DECLARATION_LINE);
  return match ? (match[1] ?? null) : null;
}

/**
 * Adds a header, merging with an earlier one of the same name (any case) the
 * way fetch combines repeated headers, so a later line does not silently
 * replace an earlier one. The first spelling of the name is kept.
 */
function addHeader(headers: Record<string, string>, name: string, value: string): void {
  const lowerName = name.toLowerCase();
  const existing = Object.keys(headers).find((key) => key.toLowerCase() === lowerName);
  if (existing === undefined) {
    headers[name] = value;
    return;
  }
  headers[existing] += `${lowerName === 'cookie' ? '; ' : ', '}${value}`;
}

/** Sets the collected body without trailing blank space; an empty one stays unset. */
function attachBody(request: HttpRequest, bodyLines: string[]): void {
  const body = bodyLines.join('\n').replace(/\s+$/, '');
  if (body) {
    request.body = body;
  }
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
      if (currentRequest && bodyLines) {
        attachBody(currentRequest, bodyLines);
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
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    const variableMatch = line.match(VARIABLE_LINE);
    if (variableMatch) {
      const name = variableMatch[1];
      const env = variableMatch[2];
      variables.push({
        name,
        env: env ?? undefined,
        value: variableMatch[3].trim(),
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

    // The query string may continue on the lines right after the request line.
    if (QUERY_CONTINUATION.test(trimmed) && Object.keys(currentRequest.headers).length === 0) {
      currentRequest.url += trimmed;
      continue;
    }

    const headerMatch = trimmed.match(HEADER_LINE);
    if (headerMatch) {
      addHeader(currentRequest.headers, headerMatch[1], headerMatch[2].trim());
      sawHeaderOrRequest = true;
    } else {
      // Unrecognized content after headers without a blank separator:
      // treat it as the start of the body so nothing is silently dropped.
      bodyLines = [line];
    }
  }

  if (currentRequest && bodyLines) {
    attachBody(currentRequest, bodyLines);
  }

  const activeEnvironment = readActiveEnvironment(text);
  const lookup = resolveVariables(variables, activeEnvironment);

  for (const request of requests) {
    request.url = interpolate(request.url, lookup);
    for (const name of Object.keys(request.headers)) {
      request.headers[name] = interpolate(request.headers[name], lookup);
    }
    if (request.body !== undefined) {
      request.body = interpolate(request.body, lookup);
    }
  }

  const environments = Array.from(
    new Set(variables.map((variable) => variable.env).filter((value): value is string => !!value))
  );

  return { variables, requests, environments, environment: activeEnvironment };
}

/** Rewrites (or inserts at the top / removes) the @env declaration line */
function setActiveEnvironment(text: string, environment: string | null): string {
  if (/^@env(?:\s*=\s*[^\n]*)?$/m.test(text)) {
    if (environment) {
      return text.replace(/^@env(?:\s*=\s*[^\n]*)?$/m, `@env = ${environment}`);
    }
    return text.replace(/^@env(?:\s*=\s*[^\n]*)?\n?/m, '');
  }
  return environment ? `@env = ${environment}\n${text}` : text;
}

export type { HttpFile, HttpRequest, HttpVariable };
export { parseHttpFile, setActiveEnvironment, readActiveEnvironment, interpolate };
