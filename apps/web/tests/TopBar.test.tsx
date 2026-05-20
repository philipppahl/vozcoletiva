import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TopBar } from '../src/components/shell/TopBar';

describe('TopBar', () => {
  it('renders the title', () => {
    render(<TopBar title="Members" />);
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('renders the eyebrow above the title', () => {
    render(<TopBar title="Members" eyebrow="My Co-op" />);
    expect(screen.getByText('My Co-op')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('shows a back chevron when onBack is provided and fires the handler', async () => {
    const onBack = vi.fn();
    render(<TopBar title="Members" onBack={onBack} />);
    const btn = screen.getByRole('button', { name: /back/i });
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the back chevron when no onBack', () => {
    render(<TopBar title="Members" />);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});
