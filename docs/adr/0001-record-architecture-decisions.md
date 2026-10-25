# 1. Record architecture decisions

Date: 2026-10-25

## Status

Accepted

## Context

The three plugins share their tooling, CI and release process, and most choices behind them were made once and applied to all three. Without a record, the reasons live only in commit messages and pull requests, and the next change to one repository can undo a choice the other two still rely on.

## Decision

Decisions that affect how the plugins are built, checked or released are written down as ADRs in `docs/adr/`, numbered, and kept identical across the three repositories.

## Consequences

A change that goes against an accepted record needs a new record that supersedes it. Feature decisions inside one plugin stay in that plugin's issues and pull requests.
