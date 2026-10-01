# Contributing to StandardNotes API Client

Thanks for helping out. This is a small, focused editor: an HTTP API
client for Standard Notes that stores requests as portable `.http` syntax
inside the note.

## Development setup

```
git clone https://github.com/Esl1h/StandardNotes-APIclient.git
cd StandardNotes-APIclient
npm install
npm start
```

`npm start` runs the standalone editor at `http://localhost:3001` (no
Standard Notes context, saving disabled).

To test inside your Standard Notes app:

```
npm run build
npm run server-cors
```

Then install `http://localhost:3000/ext.dev.json` via Preferences > Plugins
(dev extension, separate identifier).

## Before opening a PR

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build`

All four must pass. CI runs the same steps.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): one
logical change per commit, subject in the imperative mood, body explaining
the why when the what is not enough.

## Scope guidance

The parser stays dependency-free and the editor keeps the note as plain
text. Features that turn the note content into binary or JSON blobs, or
that persist responses into the note by default, do not fit the project.
Check `docs/` references and the roadmap in the README before proposing
anything heavy (proxy daemon, GraphQL, OAuth flows are planned but not
started).
