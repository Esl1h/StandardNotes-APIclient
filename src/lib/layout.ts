/**
 * Persisted layout preference: the width of the source/editor column as a
 * percentage of the two column area. Kept in localStorage (per browser)
 * with an in-range clamp; storage failures degrade to the default.
 */

const DEFAULT_SPLIT_PCT = 38;
const MIN_SPLIT_PCT = 15;
const MAX_SPLIT_PCT = 85;
const STORAGE_KEY = 'standardnotes-apiclient-split-pct';

function clampSplitPct(value: number): number {
  return Math.min(MAX_SPLIT_PCT, Math.max(MIN_SPLIT_PCT, value));
}

function readSplitPct(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_SPLIT_PCT;
    }
    return clampSplitPct(Number(stored));
  } catch {
    return DEFAULT_SPLIT_PCT;
  }
}

function writeSplitPct(pct: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampSplitPct(pct)));
  } catch {
    // Non persistable contexts keep the in-memory ratio only.
  }
}

export { DEFAULT_SPLIT_PCT, clampSplitPct, readSplitPct, writeSplitPct };
