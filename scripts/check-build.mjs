#!/usr/bin/env node
// Fails when build/ holds a file that nothing in the build references,
// so stray images in public/ do not end up in extension.zip and Pages.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = 'build';
// Fetched by name from outside the build: the host, the browser, Pages.
const entryPoints = new Set([
  'index.html',
  'demo.html',
  'ext.json',
  'ext.dev.json',
  'package.json',
  'CNAME',
  'robots.txt',
]);
const textFile = /\.(html|js|css|json|txt)$/;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(root, join(dir, entry.name))]
  );

const files = walk(root);
const texts = files
  .filter((file) => textFile.test(file))
  .map((file) => ({ file, body: readFileSync(join(root, file), 'utf8') }));

const unused = files.filter(
  (file) =>
    !entryPoints.has(file) &&
    !texts.some(({ file: other, body }) => other !== file && body.includes(basename(file)))
);

if (unused.length) {
  console.error(`Unreferenced files in ${root}/:\n  ${unused.join('\n  ')}`);
  process.exit(1);
}
console.log(`${files.length} files in ${root}/, all referenced`);
