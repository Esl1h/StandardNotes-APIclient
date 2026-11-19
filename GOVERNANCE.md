# Governance

StandardNotes API Client is a small project with a single maintainer. This
file says how decisions are made, who does what, and what the project can
and cannot promise.

## Decision making

The maintainer, [Esl1h](https://github.com/Esl1h), makes all final
decisions: what is merged, what is released and what is out of scope. The
scope rules are in [CONTRIBUTING.md](CONTRIBUTING.md#scope-guidance), and
the lasting technical decisions are recorded as
[ADRs](docs/adr/README.md).

- Anyone can propose a change with an issue or a pull request
- A change is accepted when the maintainer judges that it fits the scope,
  follows [CONTRIBUTING.md](CONTRIBUTING.md), and passes CI. Every change,
  the maintainer's own included, reaches `main` through a pull request with
  signed commits and a green CI run (see
  [ADR 0006](docs/adr/0006-merge-commits-signed-history-verifiable-releases.md))
- A disagreement is settled in the issue or pull request where it came up:
  the maintainer explains the decision and its reason. If you still
  disagree, the license lets you fork the project
- Behavior in the community follows the [Code of Conduct](CODE_OF_CONDUCT.md)

## Roles and responsibilities

- **Maintainer** (Esl1h, the only holder of this role): triages issues and
  pull requests, reviews and merges changes, decides the roadmap, cuts
  releases, keeps dependencies current, handles security reports and
  enforces the Code of Conduct
- **Contributor** (anyone who opens an issue, a pull request or a
  discussion): follows [CONTRIBUTING.md](CONTRIBUTING.md) and the Code of
  Conduct, adds tests for what they change, and agrees that the
  contribution is licensed under the project's
  [AGPL-3.0-or-later](LICENSE) license
- **Security reporter** (anyone who finds a vulnerability): reports it
  privately as described in [SECURITY.md](SECURITY.md#reporting-a-vulnerability)
  and gives the maintainer time to fix it before disclosing it. The
  maintainer acknowledges and answers within the times stated in
  [SECURITY.md](SECURITY.md#responding-to-reports) and credits the reporter
  unless they ask for anonymity

## Releases

The maintainer publishes releases; the steps are under
[Releases](README.md#releases) in the README, and how to verify a release
is under [Verifying a release](README.md#verifying-a-release). The release
workflow refuses to publish a commit without a green CI run.

## Supported versions

Only the [latest release](https://github.com/Esl1h/StandardNotes-APIclient/releases/latest)
is supported, for bug fixes and security fixes alike. There are no
maintenance branches.

To upgrade, install the new version the way you installed the old one (the
hosted `ext.json` URL updates itself when the app compares versions). Notes
are plain `.http` text, so they keep working across versions. When the note
format gains something, the [Note format](README.md#note-format) section
describes it, and `CHANGELOG.md` lists what changed in each release.

## Continuity

The project depends on one person. No second person holds the repository
admin rights, the release permissions or the credentials needed to publish,
so the project could not continue within a week if the maintainer became
unable to work on it. The OpenSSF Best Practices criteria `access_continuity`
and `bus_factor` are therefore **not met**. Mitigations that exist today:
the code is AGPL-3.0-or-later and can be forked by anyone, releases are
built by a public workflow from tagged commits, and the hosted build is
static files that keep working without maintenance. Adding a second
maintainer is welcome; open an issue if you would like to help.
