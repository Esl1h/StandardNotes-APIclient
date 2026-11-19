/** How long a save can come back from the app as a stale echo. */
const ECHO_WINDOW_MS = 10000;
/** A ceiling on the remembered saves so a stream of saves cannot grow it
 * without bound; the oldest echoes are the least likely to still arrive. */
const MAX_SAVES = 50;

/** Two independent 32-bit FNV-1a passes, about 64 bits to tell saves apart. */
function fingerprint(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return `${text.length}:${a >>> 0}:${b >>> 0}`;
}

/**
 * Remembers the saves of the open note made within the echo window, so a
 * late echo of an earlier one is not applied over text typed after it. Any
 * other text (a remote edit, another note) passes through.
 *
 * Only a length-and-hash fingerprint of each save is kept, not a copy of the
 * note, so a large note does not multiply in memory.
 *
 * A save is recorded per keystroke while the app only receives one after a
 * pause, so the memory is bounded by time, not by a handful of saves: an
 * echo arrives after however many keystrokes followed it.
 */
class EchoGuard {
  private noteId: string | undefined;
  private saves: Array<{ print: string; at: number }> = [];

  constructor(private now: () => number = Date.now) {}

  private forgetExpired(): void {
    const cutoff = this.now() - ECHO_WINDOW_MS;
    this.saves = this.saves.filter((save) => save.at >= cutoff);
  }

  recordSave(text: string): void {
    this.saves.push({ print: fingerprint(text), at: this.now() });
    this.forgetExpired();
    if (this.saves.length > MAX_SAVES) {
      this.saves = this.saves.slice(-MAX_SAVES);
    }
  }

  /** True when `text` streamed for `noteId` is an earlier save of ours, not `current`. */
  isStaleEcho(noteId: string | undefined, text: string, current: string): boolean {
    if (noteId !== this.noteId) {
      this.noteId = noteId;
      this.saves = [];
      return false;
    }
    if (text === current) {
      return false;
    }
    this.forgetExpired();
    const print = fingerprint(text);
    return this.saves.some((save) => save.print === print);
  }
}

export { EchoGuard, ECHO_WINDOW_MS };
