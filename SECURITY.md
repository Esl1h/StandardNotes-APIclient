# Security Policy

## Supported versions

Only the [latest release](https://github.com/Esl1h/StandardNotes-APIclient/releases/latest)
receives security fixes.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (Security tab > Report a
vulnerability) instead of opening a public issue. Please include the
affected version and, if possible, the `.http` contents that trigger the
problem.

## Responding to reports

- The maintainer acknowledges a report within 7 days
- Within 60 days the maintainer fixes the problem or explains why it is not
  a vulnerability or will not be fixed
- A fix is released as a normal release from `main`, through the process in
  [Releases](README.md#releases): pull request, green CI, signed tag,
  immutable release. The release notes say that it fixes a vulnerability
  once users can update
- Reporters are credited in the release notes of the fixing release, unless
  they ask to stay anonymous
- Please keep the details private until the fix is released

Vulnerabilities in the last 12 months: `CHANGELOG.md` records no fix for a
vulnerability reported by an outside party. The fixes in 1.0.1 and 1.0.2
that bound work (expansion of variables, response size, timeouts) came from
the maintainer's own review. The Security tab of the repository is the
authoritative list of advisories.

## Security requirements

What you can expect:

- Requests are sent only when you press Run, `Run all` or `Ctrl/Cmd+Enter`.
  Opening a note never sends anything
- Each request goes directly from your browser or the Standard Notes app to
  the host named in the request, through the browser's `fetch`. There is no
  proxy, no backend and no telemetry
- Tokens and secrets that you type into a note are stored in the note, which
  Standard Notes encrypts end to end. The plugin keeps no copy elsewhere
  and does not write responses into the note
- TLS certificates are verified by the browser; the plugin cannot turn that
  off
- A response is cut off at 25 MiB and a request at its timeout (30 s by
  default), so one request cannot freeze the editor for ever
- Note text and response bodies are shown as text, never as HTML or script

What you cannot expect:

- The plugin does not judge the requests you write. It will send a token to
  whichever host the note names, so check urls before you run a note you
  did not write, and do not run notes with real tokens in the public demo
- It does not protect against a compromised browser, device or Standard
  Notes account
- The `Copy as cURL` and `Copy as HTTPie` exports are quoted for POSIX
  shells only

Out of scope: the security of the APIs you call, and of Standard Notes
itself (see Scope below).

## Dependency monitoring

- Dependabot opens version update pull requests for npm dependencies weekly
  and for GitHub Actions monthly (`.github/dependabot.yml`)
- CI runs `npm audit --audit-level=critical` on every push and pull
  request (`.github/workflows/ci.yml`). The step is advisory and does not
  fail the build, so the maintainer reads the log
- When a dependency has a known vulnerability, the maintainer merges the
  Dependabot update, or pins a fixed version with an `overrides` entry in
  `package.json`, once CI is green, and ships it in the next release.
  Vulnerabilities that cannot be reached from the plugin are noted in the
  pull request
- The two git dependencies are pinned by commit and checked by
  `scripts/check-lockfile.mjs` ([ADR 0002](docs/adr/0002-pin-standard-notes-git-dependencies.md))

## Supply chain

- Every change reaches `main` through a pull request with signed commits and passing CI; force pushes and deletions are blocked, and release tags cannot be moved or deleted
- Workflow actions are pinned to commit hashes and run with read-only tokens unless a job needs more
- Releases are immutable and carry `SHA256SUMS` and a build provenance attestation; the README explains how to verify them
- The [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/Esl1h/StandardNotes-APIclient) checks these practices weekly. Its Code-Review and Branch-Protection checks stay low by design: this is a single-maintainer project, so pull requests are not reviewed by a second person

## Scope

- The editor runs entirely client side; request definitions live inside
  your Standard Notes note, encrypted with the rest of your account
- Requests are executed from your browser/runtime against the urls you
  specify; the editor itself does not transmit anything to any other
  destination, and responses stay in memory (never written to the note)
- Note that this is an API client: the privacy of what you send depends on
  the endpoints you point it at; review requests containing tokens before
  running them on shared screens or in the public demo page
- The hosted build is static content served from GitHub Pages
- Vulnerabilities in Standard Notes itself belong to
  [Standard Notes security](https://standardnotes.com/help/2/has-standard-notes-completed-a-third-party-security-audit)

## Assurance case

This case argues that the requirements above are met. The design is
described in [ARCHITECTURE.md](ARCHITECTURE.md).

### Threat model

Assets:

- Secrets and request data in the note (tokens, payloads, variables)
- Responses in memory, which can contain secrets
- The integrity of the note text
- The integrity of the released plugin

Attackers considered:

- Someone who gives the user a note, or a response, crafted to make the
  plugin run script, leak data or hang
- A malicious or compromised API that the user calls
- Someone who tampers with a dependency, the build or a release

Entry points:

- Note text: requests, headers, bodies, variables, directives (`@timeout`,
  `@assert`, `@name`), parsed by `src/lib/parser.ts`
- Variable expansion and chained references (`{{label.response...}}`) in
  `src/lib/parser.ts` and `src/lib/chaining.ts`
- Response status, headers and body, from `src/lib/executor.ts`, shown by
  `src/components/Block.tsx`
- The `postMessage` stream from the Standard Notes host, through EditorKit
- Dependencies and the release pipeline

Out of scope of the model: a compromised device, browser or Standard Notes
account, and the behavior of the APIs the user chooses to call.

### Trust boundaries

1. Standard Notes host to plugin (`postMessage` through EditorKit in
   `src/components/Editor.tsx`)
2. Untrusted note text and response data to the parser, the renderer and
   the exports
3. Plugin to the network, crossed only in `src/lib/executor.ts`, the single
   call site of `fetch` in `src/`
4. Source to published artifact (CI, release workflow, GitHub Pages)

### Secure design principles

- **Least privilege.** The plugin asks the host for nothing beyond
  receiving and saving the note text. The Content Security Policy
  ([ADR 0005](docs/adr/0005-content-security-policy.md), set in
  `vite.config.ts`, tested in `e2e/csp.spec.js`) allows scripts only from
  the plugin's own origin and blocks inline code, eval, plugins, `base` and
  form targets. Workflows run with read-only tokens unless a job needs more
  (`permissions` in `.github/workflows/`)
- **Fail-safe defaults.** Nothing is sent on load; a run needs a user
  action. Unresolved references stay literal text instead of being guessed,
  and a malformed `@assert` never passes silently (`src/lib/parser.ts`,
  `src/lib/asserts.ts`). If the editor crashes, the
  raw note stays visible and editable (`src/components/ErrorBoundary.tsx`)
- **Complete mediation.** Every request goes through `executeRequest`,
  which applies the timeout, the size cap, `cache: 'no-store'` and
  `referrerPolicy: 'no-referrer'` to all of them. No other code calls
  `fetch`, `XMLHttpRequest` or a socket
- **Economy of mechanism.** The parser has no dependencies, there is no
  backend, and the note stays plain text. The JSONPath support is a small
  subset (`src/lib/chaining.ts`)
- **Open design.** The code is public under AGPL-3.0-or-later, and the
  decisions are recorded in [docs/adr](docs/adr/README.md). Nothing relies
  on secrecy
- **Psychological acceptability.** A request is sent by an explicit Run
  button. Variables with names like `token` or `secret` are masked until
  shown. Blocks warn about headers a browser will not send and about
  unresolved variables. The block names a probable CORS block instead of
  failing silently (`src/lib/executor.ts`, `src/components/VariablesPanel.tsx`)

The Content Security Policy leaves `connect-src` open on purpose: the tool
exists to call arbitrary APIs, so a connection allowlist is not possible.
Styles, fonts and images are open too, for the host theme.

### Common weaknesses countered

- **Cross-site scripting through responses or note content.** Components
  render text through React, with no `dangerouslySetInnerHTML` or
  `innerHTML` in `src/`. Binary previews use a Blob URL whose type must
  match an exact allowlist, and SVG is treated as text
  (`isBinaryContentType` in `src/lib/executor.ts`, tests in
  `src/lib/executor.test.ts`). The CSP forbids inline and remote script
  even if markup got in
- **Resolved urls and secrets in attributes.** The resolved url is kept out
  of every DOM attribute, where a page stylesheet could read it
  (`src/components/Block.tsx`; test `keeps the resolved url out of every
attribute` in `src/components/Block.test.tsx`)
- **Second-order expansion.** Dynamic variables are expanded before chained
  references, so text from a response is never expanded as if the user had
  written it (`Block.run` in `src/components/Block.tsx`)
- **Unbounded work.** Variable expansion has a depth limit (64), a length
  limit (1 MiB) and a total budget (10 000 expansions), and cycles stay
  literal (`src/lib/parser.ts`; tests in `src/lib/parser.test.ts`,
  including a branching cycle and property tests that the parser never
  throws). Responses are capped at 25 MiB while streaming, recorded bodies
  at 512 KiB, the echo guard at 50 entries within 10 s, and timeouts are
  clamped (`src/lib/executor.ts`, `src/lib/chaining.ts`,
  `src/lib/echoGuard.ts`, with tests next to each)
- **Prototype pollution.** The OpenAPI export builds its maps without a
  prototype, so a path named `__proto__` is a plain key
  (`src/lib/openapi.ts`; test in `src/lib/openapi.test.ts`). Variables are
  held in `Map` objects (`src/lib/parser.ts`)
- **Regular expression denial of service.** The parser patterns are
  anchored per line and use disjoint character classes, without nested
  quantifiers (`src/lib/parser.ts`). The assert operators use lazy matches
  that are at worst polynomial on one line of the user's own note
  (`src/lib/asserts.ts`). No test targets ReDoS in particular; property
  tests feed the parser and the highlighter arbitrary text
- **Shell injection through exports.** Every value in a cURL or HTTPie
  command is quoted, and a url that starts with a dash cannot act as an
  option (`src/lib/curl.ts`, `src/lib/httpie.ts` and their tests). The
  quoting is for POSIX shells only
- **Supply chain.** Dependencies are locked in `package-lock.json` and
  installed with `npm ci`; Dependabot and `npm audit` watch them (above);
  git dependencies are pinned and checked (`scripts/check-lockfile.mjs`);
  actions are pinned to commit hashes; releases are immutable, come from
  tagged commits with green CI, and carry `SHA256SUMS` and a build
  provenance attestation (`.github/workflows/release.yml`, README
  [Verifying a release](README.md#verifying-a-release)); CodeQL and the
  OpenSSF Scorecard run on the repository

Known gaps: no second person reviews changes (see
[GOVERNANCE.md](GOVERNANCE.md#continuity)); the CSP is a meta tag, which
cannot set `frame-ancestors`; and the plugin has not been audited by a
third party.
