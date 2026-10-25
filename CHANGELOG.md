# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-25

### Fixed

- **sync:** Bound the echo guard by time, not count
- **run-all:** Stop when the note changes mid-run
- **editor:** Detect a note switch from the note id
- **parser:** Bound the expansion of variables
- **block:** Keep resolved urls out of attributes
- **chaining:** Ignore labels the note no longer has
- **parser:** Ignore @env lines inside a request body

### Documentation

- Say the exports are quoted for POSIX shells

## [1.0.0] - 2026-10-25

### Added

- Set a Content Security Policy on the page

### Fixed

- Sync stale published versions

### Documentation

- Adopt the Contributor Covenant
- Record the shared decisions as ADRs
- Align the README with the other plugins

## [0.7.2] - 2026-10-16

### Fixed

- **ui:** Copy in Chromium hosts via a selection

### Documentation

- **readme:** Bump the lockfile, release via a PR

## [0.7.1] - 2026-10-16

### Fixed

- **ui:** Confirm or report every clipboard copy
- **editor:** Stop chaining labels crossing notes
- **export:** Keep OpenAPI paths off the prototype
- **executor:** Match binary content types exactly
- **export:** Stop a dash-led url acting as option

### Documentation

- Show the current UI in both themes

## [0.7.0] - 2026-10-15

### Added

- **ui:** Show the final URL after redirects
- **export:** Copy a request as an HTTPie command
- **export:** Copy the note as an OpenAPI document
- **editor:** Highlight multipart and GraphQL bodies

### Fixed

- **chaining:** Cap the size of recorded bodies
- **readme:** Point the coverage badge at the published path

## [0.6.0] - 2026-10-15

### Added

- **chaining:** Resolve {{name.request.*}} references
- **parser:** Add a per-request # @timeout directive

### Fixed

- **ui:** Match the panel font size to the editor
- **ui:** Keep revealed variable values readable in the light theme
- **chaining:** Drop recorded chain data on note switch
- **ui:** Avoid splitting a surrogate pair at the body cap
- **a11y:** Stop nesting buttons inside a role=button block

## [0.5.2] - 2026-10-05

### Fixed

- **ui:** Color the drawn caret from the app theme

## [0.5.1] - 2026-10-05

### Fixed

- **ui:** Keep the caret visible in the dark theme

## [0.5.0] - 2026-10-05

### Added

- **parser:** Parse # @name labels for request chaining
- **exec:** Resolve chained references from earlier responses
- **editor:** Run the request under the caret with Mod-Enter
- **exec:** Generate dynamic variables on every run
- **ui:** Run every request in file order
- **ui:** Check kulala-style asserts against responses
- **ui:** Copy a request as a cURL command
- **a11y:** Navigate between blocks with the keyboard

## [0.4.0] - 2026-10-04

### Added

- **layout:** Keep split width in component data
- **block:** Warn about unresolved variables

### Fixed

- **parser:** Resolve qualified refs in their scope
- **deps:** Drop the brace-expansion override
- **github:** Make the issue template config valid
- **highlight:** Align methods and bodies
- **block:** Cap the displayed response body

### Changed

- **parser:** Drop the unused variableLookup
- **editor:** Merge the parser imports
- **block:** Move prettyPrintBody to the lib
- **highlight:** Export the stream parser spec

## [0.3.3] - 2026-10-04

### Added

- **preview:** Add a request list note preview
- **sync:** Add a guard for stale save echoes

### Fixed

- **save:** Store a short note preview
- **sync:** Ignore stale echoes of our own saves

## [0.3.2] - 2026-10-03

### Added

- **ext:** Show the code icon in the editor menu

## [0.3.1] - 2026-10-03

### Fixed

- **mobile:** Upgrade editor-kit for null host origin

## [0.3.0] - 2026-10-03

### Added

- **editor:** Add crash fallback and wait state
- **parser:** Support // comments
- **parser:** Join multiline query strings
- **parser:** Accept url-only lines with a variable
- **executor:** Hint at CORS on failed fetches
- **block:** Warn about headers browsers ignore
- **executor:** Prefer content-length for the size
- **block:** Handle binary responses
- **variables:** Mask secret values by default

### Fixed

- **highlight:** Avoid crash on indented lines
- **editor:** Do not save when a note is loaded
- **editor:** Derive the active block per render
- **editor:** Keep undo history within one note
- **parser:** Accept the HTTP version suffix
- **parser:** Drop empty bodies and trailing blanks
- **parser:** Stop cyclic variables crashing
- **layout:** Stack the panels on narrow screens
- **parser:** Merge repeated and mixed-case headers
- **editor:** Keep block state across edits above
- **variables:** Use unique keys for redefined ones
- **deps:** Override jsonwebtoken to 9.x

### Documentation

- **readme:** Document the new syntax and behavior
- **readme:** Refresh features and release steps
- **contributing:** Add the e2e step

## [0.2.7] - 2026-10-03

### Fixed

- Render synchronously so the relay listener exists before iframe load (#6)

## [0.2.5] - 2026-10-01

### Added

- Pretty print and copy for response bodies, e2e suite and dependabot

### Fixed

- Exclude e2e specs from vitest

## [0.2.4] - 2026-10-01

### Fixed

- 1px divider with wider invisible grab area, no layout gap

## [0.2.3] - 2026-10-01

### Added

- Draggable divider with persisted column width

## [0.2.2] - 2026-10-01

### Fixed

- English names for demo scenario templates

## [0.2.1] - 2026-10-01

### Added

- Scenario templates on the demo page

### Fixed

- Restore column order and scope variables panel styles

## [0.2.0] - 2026-10-01

### Added

- Environments in the .http format (@env declaration and dot suffixes)
- Codemirror editor, variables panel and block-to-source navigation

### Fixed

- Version codemirror dependencies

### Documentation

- Document environment syntax in the note format

## [0.1.0] - 2026-10-01

### Added

- .http editor core (parser, executor and UI)
- Extension manifests, assets and standalone demo page

### Fixed

- Version missing vitest setup files
