import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import VariablesPanel from './VariablesPanel';
import { type HttpVariable } from '../lib/parser';

function renderPanel(variables: HttpVariable[]) {
  return render(
    <VariablesPanel
      variables={variables}
      environments={[]}
      activeEnvironment={null}
      onSetEnvironment={() => {}}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VariablesPanel', () => {
  it('lists a redefined variable on every line without duplicate keys', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderPanel([
      { name: 'host', value: 'https://one.example', lineIndex: 0 },
      { name: 'host', value: 'https://two.example', lineIndex: 3 },
    ]);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('https://one.example')).toBeInTheDocument();
    expect(screen.getByText('https://two.example')).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });

  it('marks only the copied row as copied', () => {
    renderPanel([
      { name: 'host', value: 'https://one.example', lineIndex: 0 },
      { name: 'host', value: 'https://two.example', lineIndex: 3 },
    ]);
    const [first, second] = screen.getAllByRole('listitem');

    fireEvent.click(within(second).getByRole('button', { name: 'copy' }));

    expect(within(second).getByRole('button')).toHaveTextContent('copied');
    expect(within(first).getByRole('button')).toHaveTextContent('copy');
  });

  describe('secret values', () => {
    const MASK = '••••••••';
    const secrets: HttpVariable[] = [
      { name: 'host', value: 'https://api.example.com', lineIndex: 0 },
      { name: 'apiKey', value: 'k-123', lineIndex: 1 },
      { name: 'TOKEN', env: 'prod', value: 't-456', lineIndex: 2 },
      { name: 'db_password', value: 'p-789', lineIndex: 3 },
      { name: 'client_secret', value: 's-000', lineIndex: 4 },
    ];

    it('masks values of secret-looking names and shows the others', () => {
      renderPanel(secrets);

      expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
      for (const value of ['k-123', 't-456', 'p-789', 's-000']) {
        expect(screen.queryByText(value)).not.toBeInTheDocument();
      }
      expect(screen.getAllByText(MASK)).toHaveLength(4);
    });

    it('reveals and hides a single value', () => {
      renderPanel(secrets);
      const row = screen.getByText('apiKey').closest('li') as HTMLElement;

      fireEvent.click(within(row).getByRole('button', { name: 'show' }));
      expect(within(row).getByText('k-123')).toBeInTheDocument();
      expect(screen.queryByText('p-789')).not.toBeInTheDocument();

      fireEvent.click(within(row).getByRole('button', { name: 'hide' }));
      expect(within(row).queryByText('k-123')).not.toBeInTheDocument();
      expect(within(row).getByText(MASK)).toBeInTheDocument();
    });

    it('copies the real value even while it is masked', () => {
      const writeText = vi.fn();
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      renderPanel(secrets);
      const row = screen.getByText('apiKey').closest('li') as HTMLElement;

      fireEvent.click(within(row).getByRole('button', { name: 'copy' }));

      expect(writeText).toHaveBeenCalledWith('k-123');
      vi.unstubAllGlobals();
    });
  });
});
