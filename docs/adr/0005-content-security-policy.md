# 5. Set a Content Security Policy at build time

Date: 2026-10-25

## Status

Accepted

## Context

The plugins render note content inside the Standard Notes app, so an injected script would run with access to the note. The host loads the plugin page in an iframe and injects its theme stylesheet from wherever the app keeps themes, which differs between the web, desktop and mobile apps. The Vite dev server injects inline scripts of its own.

## Decision

A Vite plugin adds a CSP meta tag to the built pages only. Scripts load only from the plugin's own origin, with no inline code and no eval; plugins (`object-src`), `base` and form targets are blocked. Styles, fonts and images are left open for the host theme and for images linked from notes. Connections are limited to the plugin's origin, except in the API Client, whose purpose is sending requests to any endpoint. An e2e test loads a note in the web host and in the opaque-origin mobile host and fails on any violation.

## Consequences

A dependency that needs eval or inline scripts fails the e2e test and has to be configured around or replaced. Tightening styles would need a list of every place the apps serve themes from.
