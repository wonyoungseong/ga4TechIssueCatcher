/**
 * Unit Tests for IssueDetailModal Component - Story 9.4 Task 5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IssueDetailModal from '../IssueDetailModal';

// Mock Modal component
jest.mock('../Modal', () => {
  return function Modal({ isOpen, onClose, title, children, size }) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" data-size={size}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} data-testid="modal-close">Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    );
  };
});

describe('IssueDetailModal Component', () => {
  const mockResultWithIssues = {
    id: '1',
    property_name: 'Test Property',
    url: 'https://example.com',
    validation_status: 'failed',
    ga4_validation: {
      expected: 'G-XXXXX',
      actual: 'G-YYYYY',
    },
    gtm_validation: {
      expected: 'GTM-XXXXX',
      actual: 'GTM-YYYYY',
    },
    issues: [
      {
        type: 'ga4_mismatch',
        details: 'GA4 ID does not match expected value',
      },
      {
        type: 'gtm_missing',
        details: 'GTM ID not found on page',
      },
    ],
    screenshot_url: 'https://example.com/screenshot.png',
  };

  const mockResultSuccess = {
    id: '2',
    property_name: 'Success Property',
    url: 'https://success.com',
    validation_status: 'success',
    ga4_validation: {
      expected: 'G-AAAAA',
      actual: 'G-AAAAA',
    },
    gtm_validation: {
      expected: 'GTM-AAAAA',
      actual: 'GTM-AAAAA',
    },
    issues: [],
    screenshot_url: null,
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <IssueDetailModal
          isOpen={false}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('검증 결과 상세')).toBeInTheDocument();
    });

    it('should render with large size', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByTestId('modal')).toHaveAttribute('data-size', 'large');
    });

    it('should not render when result is null', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={null}
        />
      );

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('Property Information Section', () => {
    it('should display property name', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('Test Property')).toBeInTheDocument();
    });

    it('should display URL with external link', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const link = screen.getByRole('link', { name: /example\.com/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should display status badge for failed validation', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const statusBadge = screen.getByText('실패');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('status-badge', 'status-failed');
    });

    it('should display status badge for successful validation', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultSuccess}
        />
      );

      const statusBadge = screen.getByText('성공');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('status-badge', 'status-success');
    });

    it('should display N/A when property name is missing', () => {
      const resultWithoutName = { ...mockResultWithIssues, property_name: null };
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithoutName}
        />
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Task 5.2: Validation Comparison Section', () => {
    it('should show GA4 expected and actual values', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('G-XXXXX')).toBeInTheDocument();
      expect(screen.getByText('G-YYYYY')).toBeInTheDocument();
    });

    it('should show GTM expected and actual values', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('GTM-XXXXX')).toBeInTheDocument();
      expect(screen.getByText('GTM-YYYYY')).toBeInTheDocument();
    });

    it('should show mismatch status when values differ', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const mismatchStatuses = screen.getAllByText('불일치');
      expect(mismatchStatuses).toHaveLength(2); // GA4 and GTM both mismatch
    });

    it('should show match status when values are equal', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultSuccess}
        />
      );

      const matchStatuses = screen.getAllByText('일치');
      expect(matchStatuses).toHaveLength(2); // GA4 and GTM both match
    });

    it('should apply correct CSS classes for match status', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultSuccess}
        />
      );

      const successStatuses = screen.getAllByText('일치');
      successStatuses.forEach(status => {
        expect(status.parentElement).toHaveClass('comparison-status', 'success');
      });
    });

    it('should apply correct CSS classes for mismatch status', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const errorStatuses = screen.getAllByText('불일치');
      errorStatuses.forEach(status => {
        expect(status.parentElement).toHaveClass('comparison-status', 'error');
      });
    });
  });

  describe('Task 5.1: Issue Details Section', () => {
    it('should show issues section when issues exist', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('발견된 이슈')).toBeInTheDocument();
    });

    it('should not show issues section when no issues exist', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultSuccess}
        />
      );

      expect(screen.queryByText('발견된 이슈')).not.toBeInTheDocument();
    });

    it('should display issue type titles', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('GA4 ID 불일치')).toBeInTheDocument();
      expect(screen.getByText('GTM ID 누락')).toBeInTheDocument();
    });

    it('should display issue descriptions', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText(/Google Analytics 4 측정 ID가 설정된 값과 다릅니다/)).toBeInTheDocument();
      expect(screen.getByText(/Google Tag Manager 컨테이너 ID가 페이지에서 감지되지 않았습니다/)).toBeInTheDocument();
    });

    it('should display issue details when present', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('GA4 ID does not match expected value')).toBeInTheDocument();
      expect(screen.getByText('GTM ID not found on page')).toBeInTheDocument();
    });

    it('should apply correct severity class for critical issues', () => {
      const resultWithCritical = {
        ...mockResultWithIssues,
        issues: [{ type: 'ga4_missing', details: 'Critical issue' }],
      };

      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithCritical}
        />
      );

      const issueCard = screen.getByText('GA4 ID 누락').closest('.issue-card');
      expect(issueCard).toHaveClass('severity-critical');
    });

    it('should apply correct severity class for high issues', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const issueCard = screen.getByText('GA4 ID 불일치').closest('.issue-card');
      expect(issueCard).toHaveClass('severity-high');
    });

    it('should handle unknown issue types', () => {
      const resultWithUnknown = {
        ...mockResultWithIssues,
        issues: [{ type: 'unknown_issue_type', details: 'Unknown issue' }],
      };

      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithUnknown}
        />
      );

      expect(screen.getByText('알 수 없는 이슈')).toBeInTheDocument();
    });
  });

  describe('Task 5.4: Resolution Guide Links', () => {
    it('should display resolution guide links', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const guideLinks = screen.getAllByText('해결 가이드 보기');
      expect(guideLinks).toHaveLength(2); // One for each issue
    });

    it('should have correct URLs for GA4 issues', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const ga4GuideLink = screen.getAllByRole('link', { name: /해결 가이드 보기/i })[0];
      expect(ga4GuideLink).toHaveAttribute('href', 'https://support.google.com/analytics/answer/9304153');
      expect(ga4GuideLink).toHaveAttribute('target', '_blank');
    });

    it('should have correct URLs for GTM issues', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const gtmGuideLink = screen.getAllByRole('link', { name: /해결 가이드 보기/i })[1];
      expect(gtmGuideLink).toHaveAttribute('href', 'https://support.google.com/tagmanager/answer/6103696');
    });
  });

  describe('Task 5.3: Screenshot Section', () => {
    it('should show screenshot section when URL exists', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('스크린샷')).toBeInTheDocument();
      expect(screen.getByAltText('Page screenshot')).toBeInTheDocument();
    });

    it('should not show screenshot section when URL is missing', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultSuccess}
        />
      );

      expect(screen.queryByText('스크린샷')).not.toBeInTheDocument();
    });

    it('should display screenshot thumbnail with correct src', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const thumbnail = screen.getByAltText('Page screenshot');
      expect(thumbnail).toHaveAttribute('src', 'https://example.com/screenshot.png');
    });

    it('should have view button for screenshot', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      expect(screen.getByText('확대 보기')).toBeInTheDocument();
    });

    it('should open full-screen modal when thumbnail is clicked', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const thumbnail = screen.getByAltText('Page screenshot');
      fireEvent.click(thumbnail);

      expect(screen.getByAltText('Full screenshot')).toBeInTheDocument();
    });

    it('should open full-screen modal when view button is clicked', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const viewButton = screen.getByText('확대 보기');
      fireEvent.click(viewButton);

      expect(screen.getByAltText('Full screenshot')).toBeInTheDocument();
    });

    it('should close full-screen modal when close button is clicked', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      // Open full-screen modal
      const viewButton = screen.getByText('확대 보기');
      fireEvent.click(viewButton);

      // Close it
      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(screen.queryByAltText('Full screenshot')).not.toBeInTheDocument();
    });

    it('should close full-screen modal when backdrop is clicked', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      // Open full-screen modal
      const viewButton = screen.getByText('확대 보기');
      fireEvent.click(viewButton);

      // Click backdrop
      const backdrop = screen.getByAltText('Full screenshot').parentElement.parentElement;
      fireEvent.click(backdrop);

      expect(screen.queryByAltText('Full screenshot')).not.toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should call onClose when modal close button is clicked', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      const closeButton = screen.getByTestId('modal-close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should hide main modal when screenshot modal is open', () => {
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={mockResultWithIssues}
        />
      );

      // Open screenshot modal
      const viewButton = screen.getByText('확대 보기');
      fireEvent.click(viewButton);

      // Main modal should not be visible (Modal is not rendered when screenshot is selected)
      expect(screen.queryByText('검증 결과 상세')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle result without ga4_validation', () => {
      const resultWithoutGA4 = { ...mockResultWithIssues, ga4_validation: null };
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithoutGA4}
        />
      );

      // Should show N/A for missing validation
      const naCodes = screen.getAllByText('N/A');
      expect(naCodes.length).toBeGreaterThan(0);
    });

    it('should handle result without gtm_validation', () => {
      const resultWithoutGTM = { ...mockResultWithIssues, gtm_validation: null };
      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithoutGTM}
        />
      );

      // Should show N/A for missing validation
      const naCodes = screen.getAllByText('N/A');
      expect(naCodes.length).toBeGreaterThan(0);
    });

    it('should handle issues without details', () => {
      const resultWithoutDetails = {
        ...mockResultWithIssues,
        issues: [{ type: 'ga4_mismatch' }], // No details field
      };

      render(
        <IssueDetailModal
          isOpen={true}
          onClose={mockOnClose}
          result={resultWithoutDetails}
        />
      );

      // Should still render the issue without crashing
      expect(screen.getByText('GA4 ID 불일치')).toBeInTheDocument();
    });
  });
});
