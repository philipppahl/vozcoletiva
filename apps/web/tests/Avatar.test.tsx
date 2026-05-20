import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from '../src/components/shell/Avatar';

describe('Avatar', () => {
  it('renders initials from a multi-word display name', () => {
    render(<Avatar displayName="Marina Costa" size={32} />);
    expect(screen.getByText('MC')).toBeInTheDocument();
  });

  it('renders two-letter initial when only one name is given', () => {
    render(<Avatar displayName="philipp" size={32} />);
    expect(screen.getByText('PH')).toBeInTheDocument();
  });

  it('falls back to a question mark when display name is empty', () => {
    render(<Avatar displayName="" size={32} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
