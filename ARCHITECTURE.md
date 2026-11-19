# Architecture

StandardNotes API Client is a static web page that Standard Notes loads in
an iframe as a note editor. It shows the note as `.http` text and runs the
requests in it with the browser's `fetch`. There is no server of our own.

## Components and data flow

```
Standard Notes app  <--postMessage-->  Editor  -->  EditorInternal  -->  Block  -->  fetch  -->  user's API
   (host, iframe)        EditorKit      |            CodeMirror          executor
                                        +-- parser, EchoGuard
```

- **Editor** (`src/components/Editor.tsx`): the only component that talks
  to the host, through `@standardnotes/editor-kit`, which implements the
  Standard Notes relay over `postMessage`. It receives the note text,
  parses it with the parser, and saves edits (coalesced, 350 ms). If a save
  throws inside Standard Notes it shows a "Not saved" notice.
- **EchoGuard** (`src/lib/echoGuard.ts`): the host can echo an earlier save
  back after the user typed more. The guard keeps a length-and-hash
  fingerprint of recent saves (10 s window, at most 50) and drops a
  streamed text that matches one of them, so stale text never overwrites
  newer typing.
- **Parser** (`src/lib/parser.ts`): turns the note into requests,
  variables and environments. Variable values may reference other
  variables; expansion is bounded by a nesting depth (64), a resolved
  length (1 MiB) and an expansion budget (10 000 per parse), and cycles stay
  literal text. Chained references (`{{label.response...}}`) are left
  untouched here.
- **EditorInternal** (`src/components/EditorInternal.tsx`): hosts the
  CodeMirror source view (highlighting in `src/lib/httpHighlight.ts`), the
  variables panel, the list of **Block** components, `Run all` and the
  exports (cURL, HTTPie, OpenAPI).
- **Block** (`src/components/Block.tsx`): one request. On Run it resolves
  dynamic variables (`src/lib/dynamicVars.ts`), then chained references
  (`src/lib/chaining.ts`, from responses recorded in memory by earlier
  runs, bodies capped at 512 KiB), then calls the executor and renders the
  response and the asserts (`src/lib/asserts.ts`).
- **Executor** (`src/lib/executor.ts`): one `fetch` per request, with
  `cache: 'no-store'` and `referrerPolicy: 'no-referrer'`, a timeout
  (default 30 s, per request through `# @timeout`, clamped to the timer
  limit), cancellation, and a 25 MiB cap on the response, enforced while
  reading the stream. Binary types are kept as a Blob for preview or
  download; everything else is decoded as text.

Resolved values, responses and recorded chain data live in memory only.
They are never written into the note, and the note text is never modified
by a run.

## Build and release

Vite builds the page (`npm run build`), adds a Content Security Policy
meta tag (`vite.config.ts`, [ADR 0005](docs/adr/0005-content-security-policy.md))
and lists bundled licenses in `THIRD_PARTY_LICENSES.md`. CI
(`.github/workflows/ci.yml`) runs the checks on every push and pull
request. Pushing a `v*` tag runs `.github/workflows/release.yml`: it
requires a green CI run for the commit, rebuilds, attaches `extension.zip`
and `SHA256SUMS` with a build provenance attestation to an immutable
GitHub release, and publishes the same build to the `gh-pages` branch,
which GitHub Pages serves. Standard Notes installs from `ext.json` there.

## Trust boundaries

1. **Standard Notes host to plugin.** The page runs in the host's iframe
   and receives the note over `postMessage` through EditorKit, which is
   pinned by commit ([ADR 0002](docs/adr/0002-pin-standard-notes-git-dependencies.md)).
   The plugin has no other channel to the host.
2. **Note content and response data are untrusted input.** Both are
   rendered through React text nodes and CodeMirror, never as HTML. A
   resolved url never goes into a DOM attribute. Text taken from a recorded
   response is substituted after dynamic variables, so it is not expanded
   again as if the user had typed it.
3. **Plugin to the user's API.** The plugin sends only requests the user
   wrote, to the hosts the user chose, and only when the user presses Run
   (or `Run all`, or `Ctrl/Cmd+Enter`). The browser enforces TLS
   verification and CORS. There is no proxy and no telemetry. The CSP
   leaves `connect-src` open because the tool must call arbitrary APIs.
4. **Hosting.** The build is static files on GitHub Pages, produced by the
   release workflow.

## Key properties

- Work is bounded: variable expansion, response size, recorded bodies,
  echo guard memory and timeouts all have fixed limits
- The note is plain text, so it stays portable and searchable
- The parser and the libraries in `src/lib/` do not depend on React or the
  host, which keeps them testable with unit tests; behavior that needs a
  browser is covered by the Playwright suite in `e2e/`, which drives the
  editor through a fake host (`e2e/snHost.js`)

The security argument built on this design is in the
[assurance case](SECURITY.md#assurance-case).
