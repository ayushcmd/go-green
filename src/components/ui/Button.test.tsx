import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with children text and correct variant', () => {
    render(<Button variant="primary">Launch Kernel</Button>);
    const btn = screen.getByRole('button', { name: /launch kernel/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-gogreen-primary');
  });

  it('respects disabled attribute', () => {
    render(<Button disabled>Disabled Action</Button>);
    const btn = screen.getByRole('button', { name: /disabled action/i });
    expect(btn).toBeDisabled();
  });
});
