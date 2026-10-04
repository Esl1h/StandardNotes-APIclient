/** How long a save can come back from the app as a stale echo. */
const ECHO_WINDOW_MS = 10000;
const MAX_SAVES = 5;

/**
 * Remembers the latest saves of the open note, so a late echo of an earlier
 * one is not applied over text typed after it. Any other text (a remote edit,
 * another note) passes through.
 */
class EchoGuard {
  private noteId: string | undefined;
  private saves: Array<{ text: string; at: number }> = [];

  constructor(private now: () => number = Date.now) {}

  recordSave(text: string): void {
    this.saves = [...this.saves, { text, at: this.now() }].slice(-MAX_SAVES);
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
    const cutoff = this.now() - ECHO_WINDOW_MS;
    return this.saves.some((save) => save.at >= cutoff && save.text === text);
  }
}

export { EchoGuard, ECHO_WINDOW_MS };
