/**
 * Unit Tests for EmptyState Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmptyState from '../EmptyState';

describe('EmptyState Component', () => {
  it('should render default empty state', () => {
    render(<EmptyState />);
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument();
  });

  it('should render custom icon', () => {
    render(<EmptyState icon="🔍" />);
    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('should render custom title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<EmptyState description="Try adjusting your filters" />);
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.empty-state-description')).not.toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const action = <button>Add Item</button>;
    render(<EmptyState action={action} />);
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('should not render action when not provided', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.empty-state-action')).not.toBeInTheDocument();
  });
});
