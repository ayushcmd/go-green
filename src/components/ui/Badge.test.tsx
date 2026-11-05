import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders badge with correct text content', () => {
    render(<Badge variant="primary">ONLINE</Badge>);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });
});
