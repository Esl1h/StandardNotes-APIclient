# Security Policy

## Supported versions

Only the [latest release](https://github.com/Esl1h/StandardNotes-APIclient/releases/latest)
receives security fixes.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (Security tab > Report a
vulnerability) instead of opening a public issue. Please include the
affected version and, if possible, the `.http` contents that trigger the
problem.

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
