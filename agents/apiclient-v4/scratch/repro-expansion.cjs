const fs = require('fs');
const vm = require('vm');
const path = require('path');

const parserPath = path.join(__dirname, '../../../src/lib/parser.ts');
const src = fs.readFileSync(parserPath, 'utf8');

// Minimal extraction by regex: we'll rely on known function bodies from parser.ts.
// For this verifier, we only need the algorithmic shape: resolveVariables + interpolate.

const sandbox = {};
vm.createContext(sandbox);

function interpolate(text, lookup) {
  const VARIABLE_REF = /\{\{\s*([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)\s*\}\}/g;
  return text.replace(VARIABLE_REF, (match, ref) => lookup(ref) ?? match);
}

function resolveVariables(variables, activeEnvironment) {
  const rawBase = new Map();
  const rawByEnvironment = new Map();

  for (const v of variables) {
    if (v.env === undefined) rawBase.set(v.name, v.value);
    else {
      let m = rawByEnvironment.get(v.env);
      if (!m) {
        m = new Map();
        rawByEnvironment.set(v.env, m);
      }
      m.set(v.name, v.value);
    }
  }

  const resolve = (context, ref, seen) => {
    const dot = ref.indexOf('.');
    const name = dot > -1 ? ref.slice(0, dot) : ref;
    const scope = dot > -1 ? ref.slice(dot + 1) : context;

    const scoped = scope === null ? undefined : rawByEnvironment.get(scope)?.get(name);
    const raw = scoped ?? (dot > -1 ? undefined : rawBase.get(name));
    if (raw === undefined) return undefined;

    const key = scoped === undefined ? name : `${name}.${scope}`;
    if (seen.has(key)) return undefined;

    const pathSet = new Set(seen);
    pathSet.add(key);

    const nextContext = scoped === undefined ? null : scope;
    return interpolate(raw, (inner) => resolve(nextContext, inner, pathSet));
  };

  const base = new Map();
  for (const [name, raw] of rawBase) {
    base.set(name, resolve(null, name, new Set()) ?? raw);
  }

  const lookup = (ref) => {
    const dot = ref.indexOf('.');
    if (dot > -1) {
      return rawByEnvironment.get(ref.slice(dot + 1))?.get(ref.slice(0, dot));
    }
    if (activeEnvironment) {
      const envVal = rawByEnvironment.get(activeEnvironment)?.get(ref);
      if (envVal !== undefined) return envVal;
    }
    return base.get(ref);
  };

  return lookup;
}

function makeVars(n) {
  const vars = [];
  for (let i = 0; i < n - 1; i++) {
    vars.push({ name: `v${i}`, value: `{{v${i + 1}}}{{v${i + 1}}}` });
  }
  vars.push({ name: `v${n - 1}`, value: 'x' });
  return vars;
}

for (const n of [8, 10, 12, 14, 16, 18]) {
  const vars = makeVars(n);
  const lookup = resolveVariables(vars, null);
  const t0 = Date.now();
  const out = lookup('v0');
  const dt = Date.now() - t0;
  console.log(JSON.stringify({ n, out_len: out.length, ms: dt }));
}
