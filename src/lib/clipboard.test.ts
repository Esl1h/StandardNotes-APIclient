import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  // jsdom has no execCommand; each test says what the fallback returns.
  const execCommand = vi.fn<(command: string) => boolean>();

  beforeEach(() => {
    execCommand.mockReset();
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves true once the text is written', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('hi')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hi');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to copying a selection when the write is refused', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    let selected = '';
    execCommand.mockImplementation(() => {
      const area = document.querySelector('textarea') as HTMLTextAreaElement;
      selected = area.value.slice(area.selectionStart, area.selectionEnd);
      return true;
    });

    await expect(copyText('hi')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(selected).toBe('hi');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('gives the focus back after the fallback', async () => {
    vi.stubGlobal('navigator', {});
    execCommand.mockReturnValue(true);
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();

    await copyText('hi');

    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('resolves false when the fallback cannot copy either', async () => {
    vi.stubGlobal('navigator', {});
    execCommand.mockReturnValue(false);

    await expect(copyText('hi')).resolves.toBe(false);
  });
});
