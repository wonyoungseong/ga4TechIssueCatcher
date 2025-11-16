/**
 * Unit Tests for LoadingSpinner Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-loading/jest-dom';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner Component', () => {
  it('should render spinner', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have aria-label for accessibility', () => {
    render(<LoadingSpinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('should apply small size class', () => {
    const { container } = render(<LoadingSpinner size="small" />);
    expect(container.querySelector('.spinner-small')).toBeInTheDocument();
  });

  it('should apply medium size class by default', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.spinner-medium')).toBeInTheDocument();
  });

  it('should apply large size class', () => {
    const { container } = render(<LoadingSpinner size="large" />);
    expect(container.querySelector('.spinner-large')).toBeInTheDocument();
  });

  it('should render text when provided', () => {
    render(<LoadingSpinner text="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should not render text when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.loading-text')).not.toBeInTheDocument();
  });
});
