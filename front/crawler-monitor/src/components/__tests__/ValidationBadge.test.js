/**
 * Unit Tests for ValidationBadge Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidationBadge from '../ValidationBadge';

describe('ValidationBadge Component', () => {
  it('should render match state when values match', () => {
    const { container } = render(<ValidationBadge expected="GA-123" actual="GA-123" />);
    expect(container.querySelector('.match')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render mismatch state when values differ', () => {
    const { container } = render(<ValidationBadge expected="GA-123" actual="GA-456" />);
    expect(container.querySelector('.mismatch')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('should display expected and actual values in inline mode', () => {
    render(<ValidationBadge expected="GA-123" actual="GA-456" type="inline" />);
    expect(screen.getByText(/기대값:/)).toBeInTheDocument();
    expect(screen.getByText(/실제값:/)).toBeInTheDocument();
    expect(screen.getByText(/GA-123/)).toBeInTheDocument();
    expect(screen.getByText(/GA-456/)).toBeInTheDocument();
  });

  it('should render compact mode', () => {
    const { container } = render(<ValidationBadge expected="GA-123" actual="GA-456" type="compact" />);
    expect(container.querySelector('.compact')).toBeInTheDocument();
  });

  it('should render label when provided', () => {
    render(<ValidationBadge expected="GA-123" actual="GA-456" label="GA4 ID" />);
    expect(screen.getByText('GA4 ID')).toBeInTheDocument();
  });

  it('should handle null/undefined values', () => {
    render(<ValidationBadge expected={null} actual={undefined} />);
    expect(screen.getByText(/N\/A/)).toBeInTheDocument();
  });
});
