#!/usr/bin/env node
// Fails when package-lock.json pulls code from git at anything other than
// the two Standard Notes commits the plugins are built against (the same
// ones the standardnotes/plugins repo uses). A new git dependency, or one
// of these moved to another commit, has to be a deliberate change here.
import { readFileSync } from 'node:fs';

const allowed = new Set([
  'standardnotes/component-relay#164428640ba59e31e7ca3ca932b7d7521594f17c',
  'standardnotes/editor-kit#626d7a6e63d4ada48be36676c466fea46d7709d3',
]);

// Covers git+ssh/git+https URLs, the github: shorthand and tarballs from
// codeload, in both the packages and the legacy dependencies sections.
const gitRef = /"(?:git\+[^"]+|github:[^"]+|https:\/\/codeload\.github\.com\/[^"]+)"/g;
// owner/repo plus the commit, whichever of the forms above it came in.
const repoAndCommit = /github(?:\.com[/:]|:)([^/]+\/[^/#.]+)(?:\.git)?(?:#|\/tar\.gz\/)([0-9a-f]{40})\b/;

const lock = readFileSync('package-lock.json', 'utf8');
const bad = new Set();
for (const [match] of lock.matchAll(gitRef)) {
  const ref = match.slice(1, -1);
  const m = repoAndCommit.exec(ref);
  if (!m || !allowed.has(`${m[1]}#${m[2]}`)) bad.add(ref);
}

if (bad.size) {
  for (const ref of bad) console.error(`unexpected git dependency: ${ref}`);
  process.exit(1);
}
console.log('package-lock.json: git dependencies pinned to the known commits');
