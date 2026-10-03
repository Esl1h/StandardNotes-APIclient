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
});
