# StandardNotes API Client

[![CI](https://github.com/Esl1h/StandardNotes-APIclient/actions/workflows/ci.yml/badge.svg)](https://github.com/Esl1h/StandardNotes-APIclient/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Esl1h/StandardNotes-APIclient/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/Esl1h/StandardNotes-APIclient/actions/workflows/github-code-scanning/codeql)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Esl1h/StandardNotes-APIclient/badges/coverage.json)](https://github.com/Esl1h/StandardNotes-APIclient/actions/workflows/coverage.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Esl1h/StandardNotes-APIclient/badge)](https://scorecard.dev/viewer/?uri=github.com/Esl1h/StandardNotes-APIclient)
[![Release](https://img.shields.io/github/v/release/Esl1h/StandardNotes-APIclient)](https://github.com/Esl1h/StandardNotes-APIclient/releases/latest)
[![License](https://img.shields.io/github/license/Esl1h/StandardNotes-APIclient)](LICENSE)

An HTTP API client editor for [Standard Notes](https://standardnotes.com), a
free, open-source, end-to-end encrypted notes app. Requests are stored as
plain `.http` syntax (the format used by VS Code REST Client and
kulala.nvim) inside the note, so they stay readable, searchable, exportable
and portable. API tokens, payloads and variables benefit from native
end-to-end encryption, unlike typical web-based REST clients.

![API client editor running inside Standard Notes, light theme](.github/screenshots/apiclient-light.png)

![API client editor running inside Standard Notes, dark theme](.github/screenshots/apiclient-dark.png)

## Features

1. Write requests in the standard `.http`/`.rest` syntax: request blocks
   separated by `### Title` lines, optional variables at the top of the file
2. Variables defined with `@name = value`, referenced with `{{name}}` in
   urls, headers and bodies (variables can reference earlier variables)
3. Run a single request block with its `Run` button; the response renders
   inline right below the block: status (color coded), elapsed time, body
   size, headers (collapsible) and body; images are previewed and other
   binary responses can be downloaded
4. Cancel running requests and close responses; responses are volatile and
   never written to the note (your note stays lightweight and the note text
   is never modified by a run)
5. Your requests live in the note as plain text; the global Standard Notes
   search finds them by url, header name or endpoint title without opening
   the editor
6. Works with the Standard Notes web, desktop and mobile apps; follows the
   theme selected in the app. On narrow screens the editor and the requests
   stack vertically
7. A new empty note shows an `Add sample` button that seeds the note with
   working example requests against httpbin.org and jsonplaceholder
8. If the editor ever fails to render, the raw note text stays available
   and editable in a plain text area, and edits are still saved

Requests are sent straight from the editor, so only CORS-enabled endpoints
answer; see [Privacy and network](#privacy-and-network).

### Try it online

A live sandbox of the editor (no Standard Notes install needed) is hosted
next to the extension:

`https://esli.cafe/StandardNotes-APIclient/demo.html`

In the sandbox the note text is kept in your browser's localStorage and
only CORS enabled endpoints answer requests (httpbin.org and
jsonplaceholder do). Use the <strong>Reset demo</strong> button at the
bottom to restore the sample content.

## Installation

1. Run the Standard Notes web or desktop app.
2. Click the **Preferences** (gear) icon.
3. Select **Plugins** in the Preferences menu.
4. Scroll to the bottom and paste this URL into the
   **Install Custom Plugin** box:

   ```
   https://esli.cafe/StandardNotes-APIclient/ext.json
   ```

5. Confirm the installation.
6. Create a new note, open the **Editor** menu and pick **API Client**.

### Self-hosting

The hosted build is plain static files, so it can be served from anywhere. Unzip `extension.zip` from a release (or run `npm run build` and take `build/`), serve the files over HTTPS with CORS enabled, and change `url`, `download_url` and `latest_url` in `ext.json` to your host. Install your `ext.json` URL as above. To keep both the hosted and your copy installed, also change `identifier`.

## Verifying a release

Releases published from November 2026 on attach a `SHA256SUMS` file and a build provenance attestation next to `extension.zip`, the package the desktop app installs. To check a downloaded zip, run in the folder that holds both files:

```
sha256sum -c SHA256SUMS
gh attestation verify extension.zip -R Esl1h/StandardNotes-APIclient
```

The second command confirms that the zip was built by this repository's release workflow from the tagged commit. Releases are immutable: once published, their tag and files cannot be changed.

## Note format

The note body is a single `.http` file:

```http
@host = https://httpbin.org
@token = your-secret-token

### Echo POST
POST {{host}}/post
Content-Type: application/json

{"plugin": "standardnotes-apiclient"}

### Status check
GET {{host}}/status/201
Authorization: Bearer {{token}}

### CRUD example
GET https://jsonplaceholder.typicode.com/posts/1
```

- `### Title` starts a new request block
- `@name = value` defines a variable; `{{name}}` interpolates it
- Environments are defined in the file itself: `@name.staging = value`
  adds a value for the `staging` environment and `@env = staging` declares
  the active one. The editor shows environment chips above the variable
  list; requests resolve values from the active environment first and
  fall back to the unsuffixed ones. `{{name.prod}}` references an
  environment value explicitly.
- `METHOD url [HTTP/1.1]` is the request line; the version suffix is
  optional, and a bare `https://...` or `{{variable}}/path` line defaults
  to `GET`
- Lines starting with `?` or `&` right after the request line continue the
  query string
- `Name: value` lines between the request line and the first blank line are
  headers; a repeated header (in any letter case) is merged into one
- Everything after the first blank line of the block is the request body,
  without its trailing blank lines
- `#` and `//` lines outside a body are comments
- `# @name login` labels the request that follows (or the current one, before
  its body) for chaining: once it runs, later requests can interpolate
  `{{login.response.body.$.field}}` (a JSONPath subset: `$`, `.field`,
  `[index]`, `[*]`) and `{{login.response.headers.X-Token}}` from the recorded
  response, or `{{login.request.body}}` and `{{login.request.headers.X}}` from
  the request as it was sent (variables already resolved). References resolve
  at run time and are never saved into the note. Because `response` and
  `request` mark a chaining reference, an environment cannot be named
  `response` or `request`
- Dynamic variables are generated on every run, never saved:
  `{{$uuid}}`, `{{$timestamp}}` (unix seconds), `{{$randomInt 1 10}}`
  (inclusive) and `{{$datetime}}` or `{{$datetime rfc1123}}` (iso8601 by
  default)
- `# @timeout 5000` overrides the default 30 s timeout for one request, in
  milliseconds
- Multipart and GraphQL bodies get their own highlighting in the source:
  boundary delimiters and part headers in a multipart body, and GraphQL
  keywords, variables, strings and comments in a query body
- The variable list masks the value of names containing `token`, `secret`,
  `key`, `password` or `auth` until you press `show`; `copy` always copies
  the real value
- Responses are shown under each block at run time and are not saved;
  images are previewed and any binary response can be downloaded
- `Ctrl/Cmd+Enter` in the source runs the request under the caret
- `Copy as cURL` on a block copies it as a `curl` command line, with the
  variables already resolved and every value shell-quoted; `Copy as HTTPie`
  does the same as an `http` command line
- `Copy OpenAPI` copies every request in the note as an OpenAPI 3.1
  document: one operation per block, with the query string and headers as
  parameters and the body as an example
- Blocks receive the keyboard focus: `Tab` reaches them, `ArrowUp`/`ArrowDown`
  move between them and `Enter`/`Space` select one, scrolling the source to it
- `Run all` runs every request in file order, waiting for each one so a
  chained request reads the response recorded by the request before it, and
  stops at the first failure (each block shows its own error and hint)
- `# @assert <lhs> <op> <rhs>` lines inside a block are checked against its
  response and shown as ✓/✗; the left side can be `status`, `headers.<name>`,
  `body` or `body.$.path`, the operators are `==`, `!=`, `>`, `<`, `>=`, `<=`,
  `exists` and `not exists`, and a malformed assertion never passes silently
- Browsers never send headers such as `Host`, `Cookie` or `Origin`; the
  block warns when a request declares one

## Compatibility

- Standard Notes web app and desktop app (Windows, macOS, Linux)
- Standard Notes mobile apps (iOS and Android): on narrow screens the editor and the requests stack vertically, and the e2e suite drives the editor through a host with the mobile app's opaque origin and a throttled CPU
- Follows the theme selected in the app, light or dark
- Requests go out through the browser's `fetch`, in every app, so the browser's CORS rules apply (see below)

## Privacy and network

Your requests, variables and tokens are stored inside your Standard Notes note and encrypted with the rest of your data. The editor has no telemetry.

The only network traffic is the requests you run: each one goes straight from the app to the endpoint it names, with no proxy or third-party service in between, and responses stay in memory, never in the note. Because the request comes from a web page, the endpoint must allow it with CORS headers; when a request fails with a blocked fetch, the block says it is probably CORS. A local proxy companion for endpoints without CORS is planned.

The page's Content Security Policy allows scripts only from the plugin's own origin. Connections are left open, since sending requests to any endpoint is what the editor is for.

## Development and running locally

**Prerequisites:**

1. (Optional) Fork this repo on GitHub.
2. [Clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
   this repo or your fork.
3. Run `cd StandardNotes-APIclient` and then `npm install` to install all
   dependencies.

### Testing in the browser (standalone)

1. Run:

```
npm start
```

2. If no browser opens automatically, open `http://localhost:3001/`. The
   standalone editor runs without a Standard Notes context, so saving is
   disabled but the UI is fully usable.
3. When you're done, press `Ctrl/Cmd + C` in the console to stop the app.

### Testing inside your local Standard Notes app

1. Run `npm run build` to build the app, then:

```
npm run server-cors
```

2. In Standard Notes, follow the Installation steps above but paste:

```
http://localhost:3000/ext.dev.json
```

The dev extension uses a separate identifier (`API Client (Dev)`) so it
does not clash with the hosted one.

3. When you're done, press `Ctrl + C` to shut down the server.

If you run into issues, please refer to the
[Standard Notes instructions for local plugin setup](https://standardnotes.com/help/plugins/local-setup).

### Checks

CI runs these on every push and pull request; run them before opening a PR:

```
npm run typecheck       # TypeScript
npm run lint            # ESLint
npm run format:check    # Prettier
npm test                # unit tests (Vitest)
npm run build           # production build
npm run check:build     # no unreferenced file in build/
npm run check:lockfile  # git dependencies only at the known commits
npm run e2e             # end to end tests (Playwright)
```

Run `npx playwright install chromium` once before the first `npm run e2e`. The e2e suite builds the plugin and drives the demo page and a fake Standard Notes host (`e2e/snHost.js`), including the opaque origin and slow CPU of the mobile app.

### Releases

The extension is hosted on GitHub Pages from the `gh-pages` branch, served at `https://esli.cafe/StandardNotes-APIclient/`. To cut a release:

1. On a branch, run `npm run version:bump X.Y.Z`, which writes the version to `package.json`, `package-lock.json`, `public/package.json`, `public/ext.json` (with its `download_url`) and `public/ext.dev.json`, then `npm run changelog -- --tag vX.Y.Z`, which adds the section for the new version to `CHANGELOG.md` from the commits since the last tag. Commit both as `chore(release): vX.Y.Z` and merge the pull request.
2. On `main`, push the tag:

```
git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
```

The `Release` workflow fails unless the tag matches every version file. It runs the checks, attaches `extension.zip` (the package the desktop app installs) with `SHA256SUMS` and a provenance attestation to the GitHub release, writes the release notes with git-cliff and publishes the hosted build to Pages. The app finds the update by comparing the version in the `ext.json` at `latest_url`.

## Credits and license

- Built on [Standard Notes](https://standardnotes.com) and
  [@standardnotes/editor-kit](https://github.com/standardnotes/editor-kit)
- `.http` format inspired by VS Code REST Client, kulala.nvim and Bruno
- Licensed under [AGPL-3.0](LICENSE) or later
