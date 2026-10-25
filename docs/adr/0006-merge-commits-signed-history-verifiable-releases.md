# 6. Merge commits, signed history and verifiable releases

Date: 2026-10-25

## Status

Accepted

## Context

The plugins are installed by URL into an encrypted notes app, so users should be able to tell that a release came from this repository's history and was not changed after publication. The project has a single maintainer, so no second person reviews changes.

## Decision

GitHub settings are the same in all three repositories and are applied by a script the maintainer keeps outside the repositories:

- `main` accepts changes only through pull requests, with signed commits, passing CI and the branch up to date; force pushes and deletion are blocked and nobody can bypass the rules
- Pull requests are merged with a merge commit, so the commit hashes reviewed in the pull request are the ones in `main` and `.git-blame-ignore-revs` stays valid
- Release tags cannot be moved or deleted, and releases are immutable
- Workflow actions are limited to GitHub's own and the OpenSSF Scorecard, pinned to commit hashes, with read-only tokens by default
- Each release attaches `SHA256SUMS` and a build provenance attestation for `extension.zip`

## Consequences

Every change, including the maintainer's, waits for CI. The Scorecard's Code-Review and Branch-Protection checks stay low, which SECURITY.md explains.
