import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Block from './Block';
import { executeRequest, type ExecutionResult } from '../lib/executor';
import { type HttpRequest } from '../lib/parser';

vi.mock('../lib/executor', () => ({ executeRequest: vi.fn() }));
const executeMock = vi.mocked(executeRequest);

const request: HttpRequest = {
  title: 'Ping',
  method: 'GET',
  url: 'https://example.com/ping',
  headers: {},
  lineIndex: 0,
};

async function runBlock(result: ExecutionResult, overrides: Partial<HttpRequest> = {}) {
  executeMock.mockResolvedValue(result);
  const { container } = render(
    <Block request={{ ...request, ...overrides }} active={false} onSelect={() => {}} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  await waitFor(() => expect(container.querySelector('.response, .error')).not.toBeNull());
}

beforeEach(() => {
  executeMock.mockReset();
  // jsdom has no object URL support.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('Block', () => {
  it('shows the hint under a failed request', async () => {
    await runBlock({
      error: { kind: 'network', message: 'Failed to fetch', hint: 'Probable CORS block' },
    });

    expect(screen.getByText(/Request failed \(network\): Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByText('Probable CORS block')).toBeInTheDocument();
  });

  it('warns about headers the browser will not send', () => {
    render(
      <Block
        request={{ ...request, headers: { Host: 'example.com', Accept: '*/*', Cookie: 'a=1' } }}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText(/Browsers ignore these headers: Host, Cookie/)).toBeInTheDocument();
  });

  it('shows no warning when every header can be sent', () => {
    render(
      <Block
        request={{ ...request, headers: { Accept: '*/*' } }}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByText(/Browsers ignore/)).not.toBeInTheDocument();
  });

  it.each([
    [false, '5000 B'],
    [true, '12 B (decoded)'],
  ])('labels the size accordingly when decoded is %s', async (sizeIsDecoded, label) => {
    await runBlock({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: sizeIsDecoded ? 12 : 5000,
        sizeIsDecoded,
        headers: {},
        body: '{"ok": true}',
      },
    });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  describe('binary responses', () => {
    const binaryResponse = (contentType: string): ExecutionResult => ({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: 4,
        sizeIsDecoded: true,
        headers: { 'content-type': contentType },
        body: '',
        binary: { blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: contentType }), contentType },
      },
    });

    it('previews an image and offers it for download', async () => {
      await runBlock(binaryResponse('image/png'), { url: 'https://x.y/img/logo.png?v=2' });

      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview');
      const download = screen.getByRole('link', { name: /download/i });
      expect(download).toHaveAttribute('href', 'blob:preview');
      expect(download).toHaveAttribute('download', 'logo.png');
      expect(screen.queryByRole('button', { name: /copy body/i })).not.toBeInTheDocument();
    });

    it('offers other binary types for download without a preview', async () => {
      await runBlock(binaryResponse('application/pdf'), { url: 'https://x.y/' });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute('download', 'response');
    });

    it('releases the object URL when the response is closed', async () => {
      await runBlock(binaryResponse('image/png'));

      fireEvent.click(screen.getByTitle('Close response'));

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
  });
});
