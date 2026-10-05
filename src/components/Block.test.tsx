import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Block from './Block';
import { executeRequest, type ExecutionResult } from '../lib/executor';
import { type HttpRequest } from '../lib/parser';
import { forgetResponses, getResponse, recordResponse } from '../lib/chaining';

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
  forgetResponses();
});

describe('Block', () => {
  it('shows the hint under a failed request', async () => {
    await runBlock({
      error: { kind: 'network', message: 'Failed to fetch', hint: 'Probable CORS block' },
    });

    expect(screen.getByText(/Request failed \(network\): Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByText('Probable CORS block')).toBeInTheDocument();
  });

  it('resolves chained references from a recorded response at run time', async () => {
    recordResponse('login', {
      status: 200,
      timeMs: 1,
      sizeBytes: 10,
      sizeIsDecoded: true,
      headers: {},
      body: '{"token": "secret-token"}',
    });
    executeMock.mockResolvedValue({ response: undefined });
    render(
      <Block
        request={{
          ...request,
          url: 'https://example.com/x?t={{login.response.body.$.token}}',
        }}
        active={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(executeMock).toHaveBeenCalled());
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/x?t=secret-token' }),
      expect.anything()
    );
  });

  it('records the response of a named request for later chaining', async () => {
    executeMock.mockResolvedValue({
      response: {
        status: 200,
        timeMs: 1,
        sizeBytes: 10,
        sizeIsDecoded: true,
        headers: {},
        body: '{"token": "secret-token"}',
      },
    });
    render(<Block request={{ ...request, name: 'login' }} active={false} onSelect={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(getResponse('login')).toBeDefined());

    expect(getResponse('login')?.body).toBe('{"token": "secret-token"}');
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

  it('warns about variables that were not declared', () => {
    render(
      <Block
        request={{ ...request, url: 'https://{{host}}/a', headers: { 'X-Token': '{{token}}' } }}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Unresolved variables: host, token')).toBeInTheDocument();
  });

  it('does not warn about chaining references to labeled requests', () => {
    render(
      <Block
        request={{
          ...request,
          headers: { 'X-Auth': 'Bearer {{login.response.body.$.token}}' },
        }}
        requestNames={new Set(['login'])}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByText(/Unresolved variables/)).not.toBeInTheDocument();
  });

  it('warns about chaining references to labels that do not exist', () => {
    render(
      <Block
        request={{ ...request, headers: { 'X-Auth': '{{ghost.response.body.$.token}}' } }}
        requestNames={new Set(['login'])}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(
      screen.getByText('Unresolved variables: ghost.response.body.$.token')
    ).toBeInTheDocument();
  });

  it('resolves dynamic variables at run time', async () => {
    executeMock.mockResolvedValue({});
    render(
      <Block
        request={{ ...request, url: 'https://example.com/{{$randomInt 1 1}}' }}
        active={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1));
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/1' }),
      expect.anything()
    );
  });

  it('shows one pass/fail mark per assert after a response', async () => {
    await runBlock(
      {
        response: {
          status: 201,
          timeMs: 5,
          sizeBytes: 10,
          sizeIsDecoded: true,
          headers: {},
          body: '{"id": 7}',
        },
      },
      {
        asserts: ['status == 200', 'body.$.id exists'],
      } as Partial<HttpRequest>
    );

    const marks = document.querySelectorAll('.assert');
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent('✗ status == 200');
    expect(marks[0]).toHaveClass('fail');
    expect(marks[1]).toHaveTextContent('✓ body.$.id exists');
    expect(marks[1]).toHaveClass('pass');
  });

  it('shows no assert marks before a response', () => {
    render(
      <Block
        request={{ ...request, asserts: ['status == 200'] }}
        active={false}
        onSelect={() => {}}
      />
    );

    expect(document.querySelector('.assert')).toBeNull();
  });

  it('shows no variable warning when nothing is left to resolve', () => {
    render(<Block request={request} active={false} onSelect={() => {}} />);

    expect(screen.queryByText(/Unresolved variables/)).not.toBeInTheDocument();
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

  describe('large responses', () => {
    const textResponse = (body: string): ExecutionResult => ({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: body.length,
        sizeIsDecoded: false,
        headers: {},
        body,
      },
    });
    const shown = () => document.querySelector('.response-body')!.textContent!;

    it('caps the displayed body and offers the rest', async () => {
      await runBlock(textResponse('x'.repeat(300_000)));

      expect(shown().length).toBeLessThanOrEqual(200_000);
      expect(screen.getByRole('button', { name: /show all \(293 KB\)/i })).toBeInTheDocument();
    });

    it('shows the whole body after Show all', async () => {
      await runBlock(textResponse('x'.repeat(300_000)));

      fireEvent.click(screen.getByRole('button', { name: /show all/i }));

      expect(shown()).toHaveLength(300_000);
      expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument();
    });

    it('copies the whole body, not the displayed part', async () => {
      const writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });
      const body = 'x'.repeat(300_000);
      await runBlock(textResponse(body));

      fireEvent.click(screen.getByRole('button', { name: /copy body/i }));

      expect(writeText).toHaveBeenCalledWith(body);
    });

    it('does not cap a body at the limit', async () => {
      await runBlock(textResponse('x'.repeat(200_000)));

      expect(shown()).toHaveLength(200_000);
      expect(screen.queryByRole('button', { name: /show all/i })).not.toBeInTheDocument();
    });

    it('caps again on the next run', async () => {
      await runBlock(textResponse('x'.repeat(300_000)));
      fireEvent.click(screen.getByRole('button', { name: /show all/i }));
      executeMock.mockResolvedValue(textResponse('y'.repeat(300_000)));

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => expect(shown().startsWith('y')).toBe(true));
      expect(shown().length).toBeLessThanOrEqual(200_000);
    });
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
        binary: {
          blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: contentType }),
          contentType,
        },
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
      expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
        'download',
        'response'
      );
    });

    it('releases the object URL when the response is closed', async () => {
      await runBlock(binaryResponse('image/png'));

      fireEvent.click(screen.getByTitle('Close response'));

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
  });
});
