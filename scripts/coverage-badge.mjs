/**
 * Turns vitest's coverage/coverage-summary.json into a shields.io endpoint
 * badge (https://shields.io/endpoint), written to badges/coverage.json. CI
 * publishes that file to the `badges` branch, so the README badge reflects
 * the last main build without any third-party service.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SUMMARY = 'coverage/coverage-summary.json';
const OUT_DIR = 'badges';
const OUT_FILE = 'badges/coverage.json';

function colorFor(percent) {
  if (percent >= 90) {
    return 'brightgreen';
  }
  if (percent >= 80) {
    return 'yellowgreen';
  }
  if (percent >= 60) {
    return 'yellow';
  }
  return 'red';
}

function main() {
  const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
  const percent = summary.total?.lines?.pct;
  if (typeof percent !== 'number') {
    throw new Error(`no line coverage found in ${SUMMARY}`);
  }
  const badge = {
    schemaVersion: 1,
    label: 'coverage',
    message: `${percent.toFixed(0)}%`,
    color: colorFor(percent),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(badge, null, 2)}\n`);
  console.log(`${OUT_FILE}: ${badge.message} (${badge.color})`);
}

main();
