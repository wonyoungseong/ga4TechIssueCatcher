/**
 * Unit Tests for Switch Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Switch from '../Switch';

describe('Switch Component', () => {
  const defaultProps = {
    checked: false,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render switch', () => {
    render(<Switch {...defaultProps} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('should reflect checked state', () => {
    render(<Switch {...defaultProps} checked={true} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('should call onChange when clicked', () => {
    const onChange = jest.fn();
    render(<Switch {...defaultProps} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should handle Space key press', () => {
    const onChange = jest.fn();
    render(<Switch {...defaultProps} onChange={onChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.keyPress(switchElement, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should handle Enter key press', () => {
    const onChange = jest.fn();
    render(<Switch {...defaultProps} onChange={onChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.keyPress(switchElement, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(<Switch {...defaultProps} onChange={onChange} disabled={true} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should render label when provided', () => {
    render(<Switch {...defaultProps} label="Enable feature" />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('should have aria-disabled when disabled', () => {
    render(<Switch {...defaultProps} disabled={true} />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-disabled', 'true');
  });
});
