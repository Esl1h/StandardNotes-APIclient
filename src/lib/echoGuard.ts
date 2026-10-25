/** How long a save can come back from the app as a stale echo. */
const ECHO_WINDOW_MS = 10000;
/** A ceiling on the remembered saves, far above what typing fills in the
 * window, so a pathological stream of saves cannot grow it without bound. */
const MAX_SAVES = 500;

/**
 * Remembers the saves of the open note made within the echo window, so a
 * late echo of an earlier one is not applied over text typed after it. Any
 * other text (a remote edit, another note) passes through.
 *
 * A save is recorded per keystroke while the app only receives one after a
 * pause, so the memory is bounded by time, not by a handful of saves: an
 * echo arrives after however many keystrokes followed it.
 */
class EchoGuard {
  private noteId: string | undefined;
  private saves: Array<{ text: string; at: number }> = [];

  constructor(private now: () => number = Date.now) {}

  private forgetExpired(): void {
    const cutoff = this.now() - ECHO_WINDOW_MS;
    this.saves = this.saves.filter((save) => save.at >= cutoff);
  }

  recordSave(text: string): void {
    this.saves.push({ text, at: this.now() });
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
    return this.saves.some((save) => save.text === text);
  }
}

export { EchoGuard, ECHO_WINDOW_MS };
