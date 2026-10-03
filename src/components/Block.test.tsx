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
});
