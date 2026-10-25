# 3. Generate the changelog with git-cliff

Date: 2026-10-25

## Status

Accepted

## Context

The repositories follow Conventional Commits, and releases used GitHub's generated notes, which list pull requests rather than changes. Two tools were considered. release-please opens a release pull request on every push, but pull requests created with the workflow token do not start CI, so the required checks would never run without a GitHub App; its JSON updater would also overwrite the `download_url` in `ext.json` with the bare version, and it is a third-party action outside the allowed set. git-cliff builds the changelog locally from the commit history; it is also what release-plz uses in the maintainer's ndac project, so the changelog format matches that one.

## Decision

`cliff.toml` groups `feat`, `fix`, `perf`, `refactor` and `docs` commits into Keep a Changelog sections and leaves `build`, `chore`, `ci`, `style` and `test` out. `npm run changelog -- --tag vX.Y.Z` writes the new section as part of the release commit, next to `npm run version:bump X.Y.Z`. The release workflow writes the GitHub release notes with the same config.

## Consequences

Commit subjects are what users read, so `feat` and `fix` subjects must make sense on their own. Commits from before the projects adopted Conventional Commits do not appear. The release commit stays a manual step.
