/**
 * Persisted layout preference: the width of the source/editor column as a
 * percentage of the two column area, with an in-range clamp. The primary
 * store is the component data Standard Notes keeps on the editor's
 * component item; localStorage is the fallback, e.g. before registration or
 * outside the app, where it can also fail (opaque origins, sandboxed
 * iframes). Storage failures degrade to the default.
 */

/** Key/value store backed by the Standard Notes component data. */
interface PreferenceStore {
  get: (key: string) => unknown;
  set: (key: string, value: string) => void;
}

const DEFAULT_SPLIT_PCT = 38;
const MIN_SPLIT_PCT = 15;
const MAX_SPLIT_PCT = 85;
const STORAGE_KEY = 'standardnotes-apiclient-split-pct';
const STORE_KEY = 'split-pct';

let preferenceStore: PreferenceStore | null = null;

function setPreferenceStore(store: PreferenceStore | null): void {
  preferenceStore = store;
}

function clampSplitPct(value: number): number {
  return Math.min(MAX_SPLIT_PCT, Math.max(MIN_SPLIT_PCT, value));
}

function parseSplitPct(value: string): number {
  const pct = Number(value);
  return Number.isFinite(pct) ? clampSplitPct(pct) : DEFAULT_SPLIT_PCT;
}

function readSplitPct(): number {
  try {
    const synced = preferenceStore?.get(STORE_KEY);
    if (typeof synced === 'string') {
      return parseSplitPct(synced);
    }
  } catch {
    // Not registered yet; localStorage below.
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? DEFAULT_SPLIT_PCT : parseSplitPct(stored);
  } catch {
    return DEFAULT_SPLIT_PCT;
  }
}

function writeSplitPct(pct: number): void {
  const value = String(clampSplitPct(pct));
  try {
    preferenceStore?.set(STORE_KEY, value);
  } catch {
    // Not registered yet; localStorage below still keeps it.
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Non persistable contexts keep the in-memory ratio only.
  }
}

export { DEFAULT_SPLIT_PCT, clampSplitPct, readSplitPct, setPreferenceStore, writeSplitPct };
