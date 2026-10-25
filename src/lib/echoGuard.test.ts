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

  it('remembers every save within the window, however many followed it', () => {
    guard.recordSave('1');
    for (let index = 2; index <= 11; index++) {
      t += 100;
      guard.recordSave(String(index));
    }
    expect(guard.isStaleEcho('n1', '1', '11')).toBe(true);
  });

  it('forgets a save once the window has passed, even with later saves', () => {
    guard.recordSave('1');
    t = ECHO_WINDOW_MS / 2;
    guard.recordSave('2');
    t = ECHO_WINDOW_MS + 1;
    expect(guard.isStaleEcho('n1', '1', '3')).toBe(false);
    expect(guard.isStaleEcho('n1', '2', '3')).toBe(true);
  });
});
