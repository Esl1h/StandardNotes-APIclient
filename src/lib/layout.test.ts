import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SPLIT_PCT, readSplitPct, setPreferenceStore, writeSplitPct } from './layout';

afterEach(() => {
  setPreferenceStore(null);
  window.localStorage.clear();
});

describe('split width preference', () => {
  it('round trips through localStorage', () => {
    writeSplitPct(60);

    expect(readSplitPct()).toBe(60);
  });

  it('clamps the value to the allowed range', () => {
    writeSplitPct(5);
    expect(readSplitPct()).toBe(15);
    writeSplitPct(99);
    expect(readSplitPct()).toBe(85);
  });

  it('prefers the component data store over localStorage', () => {
    const data: Record<string, string> = { 'split-pct': '70' };
    setPreferenceStore({ get: (key) => data[key], set: (key, value) => (data[key] = value) });
    window.localStorage.setItem('standardnotes-apiclient-split-pct', '20');

    expect(readSplitPct()).toBe(70);
  });

  it('falls back to the default for an invalid stored value', () => {
    setPreferenceStore({ get: () => 'wide', set: () => undefined });

    expect(readSplitPct()).toBe(DEFAULT_SPLIT_PCT);
  });

  it('writes to the store and to localStorage', () => {
    const data: Record<string, string> = {};
    setPreferenceStore({ get: (key) => data[key], set: (key, value) => (data[key] = value) });

    writeSplitPct(55);

    expect(data['split-pct']).toBe('55');
    expect(window.localStorage.getItem('standardnotes-apiclient-split-pct')).toBe('55');
  });

  it('falls back to localStorage while the store is not ready', () => {
    const notReady = () => {
      throw new Error('The component has not been initialized.');
    };
    setPreferenceStore({ get: notReady, set: notReady });

    writeSplitPct(45);

    expect(readSplitPct()).toBe(45);
  });
});
