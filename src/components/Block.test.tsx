import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Block from './Block';
import { executeRequest, type ExecutionResult } from '../lib/executor';
import { type HttpRequest } from '../lib/parser';
import { getRequest, getResponse, recordResponse, resetChaining } from '../lib/chaining';

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
  resetChaining();
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

  it('records the sent request, after run-time resolution, of a named request', async () => {
    executeMock.mockResolvedValue({
      response: {
        status: 200,
        timeMs: 1,
        sizeBytes: 10,
        sizeIsDecoded: true,
        headers: {},
        body: 'ok',
      },
    });
    render(
      <Block
        request={{
          ...request,
          name: 'echo',
          body: 'id={{$randomInt 1 1}}',
          headers: { 'X-Trace': '{{ghost.response.body.$.t}}' },
        }}
        active={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(getRequest('echo')).toBeDefined());

    expect(getRequest('echo')?.body).toBe('id=1');
    // Unresolvable references stay literal in the sent request.
    expect(getRequest('echo')?.headers['X-Trace']).toBe('{{ghost.response.body.$.t}}');
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

  it('passes a request timeout to the executor and omits it when unset', async () => {
    executeMock.mockResolvedValue({});
    render(<Block request={{ ...request, timeoutMs: 2500 }} active={false} onSelect={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1));
    expect(executeMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ timeoutMs: 2500 })
    );

    render(<Block request={request} active={false} onSelect={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Run' })[1]);

    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2));
    expect(executeMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.not.objectContaining({ timeoutMs: expect.anything() })
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

  it('copies the request as a cURL command', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(
      <Block
        request={{ ...request, method: 'POST', body: '{"a": 1}' }}
        active={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy as cURL' }));

    expect(writeText).toHaveBeenCalledWith(
      "curl -X POST 'https://example.com/ping' --data-raw '{\"a\": 1}'"
    );
  });

  it('copies the request as an HTTPie command', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(
      <Block
        request={{ ...request, method: 'POST', body: '{"a": 1}' }}
        active={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy as HTTPie' }));

    expect(writeText).toHaveBeenCalledWith(
      "http POST 'https://example.com/ping' --raw '{\"a\": 1}'"
    );
  });

  it('confirms a copy on the button, then restores its label', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    render(<Block request={request} active={false} onSelect={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy as cURL' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy as HTTPie' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByRole('button', { name: 'Copy as cURL' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reports a copy the browser refused', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    });
    render(<Block request={request} active={false} onSelect={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy as HTTPie' }));

    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });

  it('moves the focus between blocks with the arrow keys', () => {
    render(
      <div>
        <Block
          request={{ ...request, url: 'https://example.com/a' }}
          active={false}
          onSelect={() => {}}
        />
        <Block
          request={{ ...request, url: 'https://example.com/b' }}
          active={false}
          onSelect={() => {}}
        />
      </div>
    );
    const [first, second] = document.querySelectorAll<HTMLElement>('.block');

    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('activates the block with Enter or Space, not keys meant for its buttons', () => {
    const onSelect = vi.fn();
    render(<Block request={request} active={false} onSelect={onSelect} />);
    const block = document.querySelector('.block') as HTMLElement;

    fireEvent.keyDown(block, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(block, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Run' }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
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

  it('shows the final URL after a redirect', async () => {
    await runBlock({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: 10,
        sizeIsDecoded: false,
        headers: {},
        body: 'ok',
        redirectedTo: 'https://example.com/final',
      },
    });

    expect(screen.getByText('→ https://example.com/final')).toBeInTheDocument();
  });

  it('keeps the resolved url out of every attribute, where a stylesheet could read it', async () => {
    const url = 'https://example.com/files/report.png?token=secret-value';
    executeMock.mockResolvedValue({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: 4,
        sizeIsDecoded: true,
        headers: { 'content-type': 'image/png' },
        body: '',
        redirectedTo: 'https://example.com/final?token=secret-value',
        binary: { blob: new Blob([new Uint8Array([1])]), contentType: 'image/png' },
      },
    });
    const { container } = render(
      <Block request={{ ...request, url }} active={false} onSelect={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText(/→/);

    for (const element of container.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        expect(attribute.value).not.toContain('secret-value');
        expect(attribute.value).not.toContain('report.png');
      }
    }
    expect(screen.getByText(url)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: `GET ${url}` })).toBeInTheDocument();
  });

  it('shows no redirect note without a redirect', async () => {
    await runBlock({
      response: {
        status: 200,
        timeMs: 5,
        sizeBytes: 10,
        sizeIsDecoded: false,
        headers: {},
        body: 'ok',
      },
    });

    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
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

    it('does not split a surrogate pair at the cut', async () => {
      // The 200000th code unit is the high half of the emoji.
      await runBlock(textResponse('a'.repeat(199_999) + '\u{1F600}' + 'b'.repeat(5)));

      expect(shown()).toHaveLength(199_999);
      expect(shown().endsWith('a')).toBe(true);
      expect(shown()).not.toContain('\uFFFD');
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
      expect(download).toHaveAttribute('download', 'response.png');
      expect(screen.queryByRole('button', { name: /copy body/i })).not.toBeInTheDocument();
    });

    it('offers other binary types for download without a preview', async () => {
      await runBlock(binaryResponse('application/pdf'), { url: 'https://x.y/' });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
        'download',
        'response.pdf'
      );
    });

    it('names a download of an unknown type without an extension', async () => {
      await runBlock(binaryResponse('application/octet-stream'));

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
