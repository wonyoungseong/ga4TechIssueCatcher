/**
 * SaveResultModal Component Tests - Story 9.4 Task 6
 *
 * Tests for the save result modal component functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SaveResultModal from '../SaveResultModal';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Save: () => <span data-testid="save-icon">Save Icon</span>,
  X: () => <span data-testid="x-icon">X Icon</span>,
}));

describe('SaveResultModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const mockRunInfo = {
    id: 'run-123',
    run_date: '2025-11-01 14:30:00',
    total_properties: 25,
    properties_with_issues: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <SaveResultModal
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      expect(screen.queryByText('크롤링 결과 저장')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
    });

    it('should render all required sections', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      // Run information section
      expect(screen.getByText('실행 날짜:')).toBeInTheDocument();
      expect(screen.getByText('총 프로퍼티:')).toBeInTheDocument();
      expect(screen.getByText('이슈 발견:')).toBeInTheDocument();

      // Memo input section
      expect(screen.getByLabelText(/메모/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/이 크롤링 결과에 대한 메모를 입력하세요/)).toBeInTheDocument();

      // Character counter
      expect(screen.getByText('0/500')).toBeInTheDocument();

      // Keyboard hint
      expect(screen.getByText('Ctrl+Enter로 빠르게 저장')).toBeInTheDocument();

      // Help text
      expect(screen.getByText(/저장된 결과는/)).toBeInTheDocument();
      expect(screen.getByText('Saved Results')).toBeInTheDocument();

      // Action buttons
      expect(screen.getByRole('button', { name: /취소/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /저장/ })).toBeInTheDocument();
    });

    it('should handle missing runInfo gracefully', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={null}
        />
      );

      // Should still render memo input and buttons
      expect(screen.getByLabelText(/메모/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /저장/ })).toBeInTheDocument();

      // Run info section should not be rendered
      expect(screen.queryByText('실행 날짜:')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Run Information Section Tests
  // ============================================================================

  describe('Run Information Section', () => {
    it('should display run date correctly', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      expect(screen.getByText('2025-11-01 14:30:00')).toBeInTheDocument();
    });

    it('should display total properties count', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      expect(screen.getByText('25개')).toBeInTheDocument();
    });

    it('should display properties with issues count with highlight', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const issuesElement = screen.getByText('3개');
      expect(issuesElement).toBeInTheDocument();
      expect(issuesElement).toHaveClass('info-value', 'highlight');
    });

    it('should handle zero issues', () => {
      const runInfoWithNoIssues = {
        ...mockRunInfo,
        properties_with_issues: 0,
      };

      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={runInfoWithNoIssues}
        />
      );

      expect(screen.getByText('0개')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Memo Input Tests
  // ============================================================================

  describe('Memo Input', () => {
    it('should allow typing in memo textarea', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      fireEvent.change(textarea, { target: { value: 'Test memo content' } });

      expect(textarea).toHaveValue('Test memo content');
    });

    it('should update character counter as user types', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(screen.getByText('5/500')).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: 'Hello World' } });
      expect(screen.getByText('11/500')).toBeInTheDocument();
    });

    it('should enforce maxLength of 500 characters', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      expect(textarea).toHaveAttribute('maxLength', '500');
    });

    it('should have autoFocus on memo textarea', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      // Check that textarea is focused (autoFocus prop should focus the element)
      expect(document.activeElement).toBe(textarea);
    });

    it('should show required indicator', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const requiredIndicator = screen.getByText('*');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveClass('required');
    });
  });

  // ============================================================================
  // Button States and Interactions Tests
  // ============================================================================

  describe('Button States and Interactions', () => {
    it('should disable save button when memo is empty', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const saveButton = screen.getByRole('button', { name: /저장/ });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when memo has content', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      const saveButton = screen.getByRole('button', { name: /저장/ });

      fireEvent.change(textarea, { target: { value: 'Valid memo' } });

      expect(saveButton).not.toBeDisabled();
    });

    it('should disable save button when memo is only whitespace', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      const saveButton = screen.getByRole('button', { name: /저장/ });

      fireEvent.change(textarea, { target: { value: '   ' } });

      expect(saveButton).toBeDisabled();
    });

    it('should disable both buttons when isSaving is true', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
          isSaving={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /취소/ });
      const saveButton = screen.getByRole('button', { name: /저장 중/ });

      expect(cancelButton).toBeDisabled();
      expect(saveButton).toBeDisabled();
    });

    it('should show "저장 중..." text when isSaving is true', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
          isSaving={true}
        />
      );

      expect(screen.getByText('저장 중...')).toBeInTheDocument();
    });

    it('should disable textarea when isSaving is true', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
          isSaving={true}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      expect(textarea).toBeDisabled();
    });

    it('should call onSave with memo when save button is clicked', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      const saveButton = screen.getByRole('button', { name: /저장/ });

      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith('Test memo');
    });

    it('should call onClose and clear memo when cancel button is clicked', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      const cancelButton = screen.getByRole('button', { name: /취소/ });

      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Keyboard Shortcuts Tests
  // ============================================================================

  describe('Keyboard Shortcuts', () => {
    it('should call onSave when Ctrl+Enter is pressed', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith('Test memo');
    });

    it('should call onSave when Cmd+Enter is pressed (Mac)', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith('Test memo');
    });

    it('should not call onSave when Enter is pressed without modifier key', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should display keyboard hint for quick save', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const keyboardHint = screen.getByText('Ctrl+Enter로 빠르게 저장');
      expect(keyboardHint).toBeInTheDocument();
      expect(keyboardHint).toHaveClass('keyboard-hint');
    });
  });

  // ============================================================================
  // Modal Interactions Tests
  // ============================================================================

  describe('Modal Interactions', () => {
    it('should clear memo when modal is closed and reopened', () => {
      const { rerender } = render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textarea = screen.getByLabelText(/메모/);
      fireEvent.change(textarea, { target: { value: 'Test memo' } });
      expect(textarea).toHaveValue('Test memo');

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /취소/ });
      fireEvent.click(cancelButton);

      // Reopen modal
      rerender(
        <SaveResultModal
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      rerender(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const textareaAfterReopen = screen.getByLabelText(/메모/);
      expect(textareaAfterReopen).toHaveValue('');
    });

    it('should render Save icon', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      expect(screen.getByTestId('save-icon')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very long memo text', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const longMemo = 'a'.repeat(500);
      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: longMemo } });

      expect(textarea).toHaveValue(longMemo);
      expect(screen.getByText('500/500')).toBeInTheDocument();
    });

    it('should handle special characters in memo', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const specialMemo = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: specialMemo } });

      expect(textarea).toHaveValue(specialMemo);
    });

    it('should handle multiline memo text', () => {
      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={mockRunInfo}
        />
      );

      const multilineMemo = 'Line 1\nLine 2\nLine 3';
      const textarea = screen.getByLabelText(/메모/);

      fireEvent.change(textarea, { target: { value: multilineMemo } });

      expect(textarea).toHaveValue(multilineMemo);
    });

    it('should handle runInfo with zero values', () => {
      const runInfoWithZeros = {
        id: 'run-123',
        run_date: '2025-11-01 14:30:00',
        total_properties: 0,
        properties_with_issues: 0,
      };

      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={runInfoWithZeros}
        />
      );

      // There should be two instances of "0개" (total_properties and properties_with_issues)
      const zeroElements = screen.getAllByText('0개');
      expect(zeroElements).toHaveLength(2);
    });

    it('should handle large numbers in runInfo', () => {
      const runInfoWithLargeNumbers = {
        id: 'run-123',
        run_date: '2025-11-01 14:30:00',
        total_properties: 99999,
        properties_with_issues: 1234,
      };

      render(
        <SaveResultModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          runInfo={runInfoWithLargeNumbers}
        />
      );

      expect(screen.getByText('99999개')).toBeInTheDocument();
      expect(screen.getByText('1234개')).toBeInTheDocument();
    });
  });
});
