# 4. Check formatting in CI, not in a pre-commit hook

Date: 2026-10-25

## Status

Accepted

## Context

The Kanban plugin ran Prettier through husky and lint-staged on commit; the other two had no hook, and their formatting had drifted. A hook only runs for contributors whose install ran the `prepare` script, can be skipped with `--no-verify`, and adds a `prepare` script that the community repository would have to remove.

## Decision

No pre-commit hooks. `npm run format:check` runs `prettier --check` on the same files as `npm run pretty`, and CI fails when it does. All three use the same Prettier config, with a 100 column print width. Formatting-only commits are listed in `.git-blame-ignore-revs`.

## Consequences

Unformatted code is caught at the pull request instead of at commit time; running `npm run pretty` before pushing avoids the round trip.
