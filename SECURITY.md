# Security Policy

## Supported versions

Only the [latest release](https://github.com/Esl1h/StandardNotes-APIclient/releases/latest)
receives security fixes.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (Security tab > Report a
vulnerability) instead of opening a public issue. Please include the
affected version and, if possible, the `.http` contents that trigger the
problem.

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
