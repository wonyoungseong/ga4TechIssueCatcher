/**
 * Unit Tests for Modal Component
 *
 * Tests modal dialog functionality including accessibility and user interactions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '../Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title correctly', () => {
      render(<Modal {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <Modal {...defaultProps}>
          <div data-testid="custom-content">Custom Content</div>
        </Modal>
      );
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('should render close button by default', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should not render close button when onClose is not provided', () => {
      render(<Modal {...defaultProps} onClose={undefined} />);
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('should apply small size class', () => {
      const { container } = render(<Modal {...defaultProps} size="small" />);
      const modalContent = container.querySelector('.modal-small');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply medium size class by default', () => {
      const { container } = render(<Modal {...defaultProps} />);
      const modalContent = container.querySelector('.modal-medium');
      expect(modalContent).toBeInTheDocument();
    });

    it('should apply large size class', () => {
      const { container } = render(<Modal {...defaultProps} size="large" />);
      const modalContent = container.querySelector('.modal-large');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should render action buttons when provided', () => {
      const actions = (
        <div>
          <button>Cancel</button>
          <button>Confirm</button>
        </div>
      );

      render(<Modal {...defaultProps} actions={actions} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('should not render actions footer when not provided', () => {
      const { container } = render(<Modal {...defaultProps} actions={null} />);
      const footer = container.querySelector('.modal-footer');
      expect(footer).not.toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      const { container } = render(<Modal {...defaultProps} onClose={onClose} />);

      const backdrop = container.querySelector('.modal-backdrop');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when modal content is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      const content = screen.getByText('Modal content');
      fireEvent.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when ESC key is pressed', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when other keys are pressed', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not call onClose on ESC when onClose is not provided', () => {
      render(<Modal {...defaultProps} onClose={undefined} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      // Should not throw error
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="dialog"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-label on close button', () => {
      render(<Modal {...defaultProps} />);
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Body Scroll Lock', () => {
    it('should set body overflow to hidden when modal is open', () => {
      render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body overflow when modal is closed', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('unset');
    });

    it('should restore body overflow when component unmounts', () => {
      const { unmount } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should remove keydown listener when modal closes', () => {
      const onClose = jest.fn();
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);

      onClose.mockClear();
      rerender(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should remove keydown listener on unmount', () => {
      const onClose = jest.fn();
      const { unmount } = render(<Modal {...defaultProps} onClose={onClose} />);

      unmount();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close cycles', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={false} />);

      rerender(<Modal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(<Modal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle empty title', () => {
      render(<Modal {...defaultProps} title="" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle complex children', () => {
      const complexChildren = (
        <div>
          <p>Paragraph</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <button>Action</button>
        </div>
      );

      render(<Modal {...defaultProps}>{complexChildren}</Modal>);
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('should handle onClose being changed', () => {
      const onClose1 = jest.fn();
      const onClose2 = jest.fn();

      const { rerender } = render(<Modal {...defaultProps} onClose={onClose1} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).not.toHaveBeenCalled();

      rerender(<Modal {...defaultProps} onClose={onClose2} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).toHaveBeenCalledTimes(1);
    });
  });
});
