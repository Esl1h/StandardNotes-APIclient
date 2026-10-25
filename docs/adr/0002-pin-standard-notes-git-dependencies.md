# 2. Pin the Standard Notes git dependencies

Date: 2026-10-25

## Status

Accepted

## Context

The plugins talk to the host through `@standardnotes/component-relay` (all three) and `@standardnotes/editor-kit` (API Client and Milkdown). Both come from GitHub rather than npm, at commits `1644286` and `626d7a6`, the same ones the community repository standardnotes/plugins builds against. A git dependency can move to another commit or point at another repository without anything in the build noticing, and its install scripts run on every `npm ci`.

Copying the built files of both packages into the repository (vendoring) would make the build work without access to GitHub, at the cost of carrying and updating AGPL code by hand. Offline builds are not a requirement.

## Decision

Keep the git dependencies, pinned by commit hash and integrity in `package-lock.json`. `scripts/check-lockfile.mjs` fails CI when the lockfile contains any git URL, `github:` shorthand or codeload tarball other than these two commits, and runs before `npm ci`.

## Consequences

Moving either package to another commit, or adding a git dependency, means editing the allowlist in the check, which makes it a visible part of the change. Builds still need GitHub to be reachable. If that becomes a problem, vendoring is the next step and would supersede this record.
