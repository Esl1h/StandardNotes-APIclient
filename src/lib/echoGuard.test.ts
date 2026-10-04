import { beforeEach, describe, expect, it } from 'vitest';
import { ECHO_WINDOW_MS, EchoGuard } from './echoGuard';

describe('EchoGuard', () => {
  let t: number;
  let guard: EchoGuard;

  beforeEach(() => {
    t = 0;
    guard = new EchoGuard(() => t);
    // Pins the open note, as the first stream of a note does.
    guard.isStaleEcho('n1', 'a', 'a');
  });

  it('ignores an earlier save of the same note', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'a', 'ab')).toBe(true);
  });

  it('accepts the current text', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'ab', 'ab')).toBe(false);
  });

  it('accepts text that was never saved, like a remote edit', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n1', 'xyz', 'ab')).toBe(false);
  });

  it('accepts any text after switching notes and forgets the saves', () => {
    guard.recordSave('a');
    guard.recordSave('ab');
    expect(guard.isStaleEcho('n2', 'a', 'ab')).toBe(false);
    expect(guard.isStaleEcho('n2', 'a', 'b')).toBe(false);
  });

  it('accepts an old save once the window has passed', () => {
    guard.recordSave('a');
    t = ECHO_WINDOW_MS + 1;
    expect(guard.isStaleEcho('n1', 'a', 'ab')).toBe(false);
  });

  it('remembers only the last 5 saves', () => {
    ['1', '2', '3', '4', '5', '6'].forEach((text) => guard.recordSave(text));
    expect(guard.isStaleEcho('n1', '1', '6')).toBe(false);
    expect(guard.isStaleEcho('n1', '2', '6')).toBe(true);
  });
});
