import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves true once the text is written', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('hi')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('resolves false when the write is refused', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    await expect(copyText('hi')).resolves.toBe(false);
  });

  it('resolves false when there is no clipboard', async () => {
    vi.stubGlobal('navigator', {});

    await expect(copyText('hi')).resolves.toBe(false);
  });
});
