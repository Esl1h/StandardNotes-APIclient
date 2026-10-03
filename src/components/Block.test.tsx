import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  render(<Block request={{ ...request, ...overrides }} active={false} onSelect={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  await screen.findByText(/./, { selector: '.response, .error' });
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
});
