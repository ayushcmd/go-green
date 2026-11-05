import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders application shell and GoGreen branding', () => {
    render(<App />);
    const brandElements = screen.getAllByText('GoGreen');
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    expect(brandElements[0]).toBeInTheDocument();
    
    const labElements = screen.getAllByText(/Systems Engineering Lab/i);
    expect(labElements.length).toBeGreaterThanOrEqual(1);
    expect(labElements[0]).toBeInTheDocument();
  });
});
