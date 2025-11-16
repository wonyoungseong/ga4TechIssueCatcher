/**
 * Unit Tests for Drawer Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Drawer from '../Drawer';

describe('Drawer Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Drawer',
    children: <div>Drawer content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when isOpen is true', () => {
    render(<Drawer {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<Drawer {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should position drawer on right by default', () => {
    const { container } = render(<Drawer {...defaultProps} />);
    const drawer = container.querySelector('.drawer-right');
    expect(drawer).toBeInTheDocument();
  });

  it('should position drawer on left when specified', () => {
    const { container } = render(<Drawer {...defaultProps} side="left" />);
    const drawer = container.querySelector('.drawer-left');
    expect(drawer).toBeInTheDocument();
  });

  it('should apply custom width', () => {
    const { container } = render(<Drawer {...defaultProps} width="600px" />);
    const drawer = container.querySelector('.drawer-content');
    expect(drawer).toHaveStyle({ width: '600px' });
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<Drawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when ESC key is pressed', () => {
    const onClose = jest.fn();
    render(<Drawer {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<Drawer {...defaultProps} onClose={onClose} />);

    const backdrop = container.querySelector('.drawer-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should lock body scroll when open', () => {
    render(<Drawer {...defaultProps} isOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(<Drawer {...defaultProps} isOpen={true} />);
    rerender(<Drawer {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('unset');
  });
});
