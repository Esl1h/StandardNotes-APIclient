#!/usr/bin/env node
// Keeps every file that carries the plugin version in step with
// package.json. The desktop app compares ext.json against the installed
// version to offer updates, so a drift there means users miss a release.
//
//   node scripts/version-bump.mjs 1.2.3   write the version everywhere
//   node scripts/version-bump.mjs --check fail if any file disagrees
import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

// Pinned to the tag, so an ext.json served ahead of its release asset can
// never hand out a different version than it announces.
const downloadUrl = (current, version) =>
  current.replace(/\/releases\/.*$/, `/releases/download/v${version}/extension.zip`);

const files = {
  'package.json': (j, v) => ({ ...j, version: v }),
  'package-lock.json': (j, v) => ({
    ...j,
    version: v,
    packages: { ...j.packages, '': { ...j.packages[''], version: v } },
  }),
  'public/package.json': (j, v) => ({ ...j, version: v }),
  'public/ext.json': (j, v) => ({
    ...j,
    version: v,
    download_url: downloadUrl(j.download_url, v),
  }),
  'public/ext.dev.json': (j, v) => ({ ...j, version: v }),
};

const arg = process.argv[2];
const check = arg === '--check';
const version = check ? read('package.json').version : arg;

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('usage: version-bump.mjs <x.y.z> | --check');
  process.exit(2);
}

let drift = 0;
for (const [path, update] of Object.entries(files)) {
  const current = read(path);
  const expected = update(current, version);
  if (JSON.stringify(current) === JSON.stringify(expected)) continue;
  if (check) {
    console.error(`${path} is out of sync with version ${version}`);
    drift++;
  } else {
    write(path, expected);
    console.log(`${path} -> ${version}`);
  }
}
process.exit(drift ? 1 : 0);
