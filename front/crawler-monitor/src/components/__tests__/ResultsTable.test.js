/**
 * Unit Tests for ResultsTable Component - Story 9.4 Task 2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsTable from '../ResultsTable';

// Mock ValidationBadge component
jest.mock('../ValidationBadge', () => {
  return function MockValidationBadge({ expected, actual, type, label }) {
    return (
      <div className="validation-badge" data-testid="validation-badge">
        {label}: {expected} vs {actual} ({type})
      </div>
    );
  };
});

// Mock LoadingSpinner component
jest.mock('../LoadingSpinner', () => {
  return function MockLoadingSpinner({ text }) {
    return <div data-testid="loading-spinner">{text}</div>;
  };
});

// Mock EmptyState component
jest.mock('../EmptyState', () => {
  return function MockEmptyState({ title, description, action }) {
    return (
      <div data-testid="empty-state">
        <div>{title}</div>
        <div>{description}</div>
        {action && <div>{action}</div>}
      </div>
    );
  };
});

describe('ResultsTable Component', () => {
  const mockResults = [
    {
      id: '1',
      property_name: 'Test Property 1',
      url: 'https://example.com/page1',
      validation_status: 'success',
      ga4_validation: {
        expected: 'G-XXXXX',
        actual: 'G-XXXXX',
      },
      gtm_validation: {
        expected: 'GTM-XXXXX',
        actual: 'GTM-XXXXX',
      },
      issues: [],
      screenshot_url: 'https://example.com/screenshot1.png',
    },
    {
      id: '2',
      property_name: 'Test Property 2',
      url: 'https://example.com/page2',
      validation_status: 'failed',
      ga4_validation: {
        expected: 'G-YYYYY',
        actual: 'G-ZZZZZ',
      },
      gtm_validation: {
        expected: 'GTM-YYYYY',
        actual: 'GTM-ZZZZZ',
      },
      issues: [
        { type: 'ga4_mismatch', message: 'GA4 ID mismatch' },
        { type: 'gtm_mismatch', message: 'GTM ID mismatch' },
      ],
      screenshot_url: 'https://example.com/screenshot2.png',
    },
    {
      id: '3',
      property_name: 'Test Property 3',
      url: 'https://example.com/page3',
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
    },
  ];

  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading spinner when loading is true', () => {
      render(<ResultsTable results={[]} loading={true} error={null} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('검증 결과를 불러오는 중...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error state when error is provided', () => {
      const errorMessage = 'Failed to load results';
      render(
        <ResultsTable
          results={[]}
          loading={false}
          error={errorMessage}
          onRetry={mockOnRetry}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('결과를 불러올 수 없습니다')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      render(
        <ResultsTable
          results={[]}
          loading={false}
          error="Error message"
          onRetry={mockOnRetry}
        />
      );

      const retryButton = screen.getByText('다시 시도');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no results', () => {
      render(<ResultsTable results={[]} loading={false} error={null} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('검증 결과가 없습니다')).toBeInTheDocument();
    });
  });

  describe('Results Rendering', () => {
    it('should render all results in table', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      // Check all property names are rendered
      expect(screen.getByText('Test Property 1')).toBeInTheDocument();
      expect(screen.getByText('Test Property 2')).toBeInTheDocument();
      expect(screen.getByText('Test Property 3')).toBeInTheDocument();
    });

    it('should render property URLs with external link', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const urlLinks = screen.getAllByRole('link');
      expect(urlLinks.length).toBeGreaterThan(0);

      // Check first URL link
      expect(urlLinks[0]).toHaveAttribute('href', 'https://example.com/page1');
      expect(urlLinks[0]).toHaveAttribute('target', '_blank');
    });

    it('should render validation status badges', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const successBadges = screen.getAllByText('성공');
      const failedBadges = screen.getAllByText('실패');

      expect(successBadges.length).toBe(2); // 2 success results
      expect(failedBadges.length).toBe(1); // 1 failed result
    });

    it('should render ValidationBadge components for GA4 and GTM', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const validationBadges = screen.getAllByTestId('validation-badge');

      // Should have 6 badges total (3 results * 2 validations each)
      expect(validationBadges.length).toBe(6);
    });

    it('should render issues count correctly', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      // Property 2 has 2 issues
      const issuesBadge = screen.getByText('2');
      expect(issuesBadge).toBeInTheDocument();

      // Properties 1 and 3 have no issues
      const noIssues = screen.getAllByText('없음');
      expect(noIssues.length).toBe(2);
    });

    it('should render screenshot links when available', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const screenshotLinks = screen.getAllByText('보기');
      expect(screenshotLinks.length).toBe(2); // Only 2 results have screenshots
    });

    it('should render dash for missing screenshot', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      // Property 3 has no screenshot
      const cells = screen.getAllByText('-');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should truncate long URLs', () => {
      const longUrlResult = [{
        id: '4',
        property_name: 'Long URL Property',
        url: 'https://example.com/very/long/path/that/exceeds/fifty/characters/and/should/be/truncated',
        validation_status: 'success',
        ga4_validation: { expected: 'G-TEST', actual: 'G-TEST' },
        gtm_validation: { expected: 'GTM-TEST', actual: 'GTM-TEST' },
        issues: [],
        screenshot_url: null,
      }];

      render(<ResultsTable results={longUrlResult} loading={false} error={null} />);

      // URL should be truncated
      const urlText = screen.getByRole('link').textContent;
      expect(urlText).toContain('...');
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort by property name in ascending order by default', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const rows = screen.getAllByRole('row');
      // Skip header row, check data rows
      expect(rows[1]).toHaveTextContent('Test Property 1');
      expect(rows[2]).toHaveTextContent('Test Property 2');
      expect(rows[3]).toHaveTextContent('Test Property 3');
    });

    it('should toggle property name sort direction on click', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const propertyHeader = screen.getByText('프로퍼티').closest('th');

      // Initial state - ascending by default
      let rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Test Property 1');

      // First click - should toggle to descending
      fireEvent.click(propertyHeader);
      rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Test Property 3');

      // Second click - should toggle back to ascending
      fireEvent.click(propertyHeader);
      rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Test Property 1');
    });

    it('should sort by status when status column is clicked', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const statusHeader = screen.getByText('상태').closest('th');
      fireEvent.click(statusHeader);

      const rows = screen.getAllByRole('row');
      // Failed comes before success alphabetically
      expect(rows[1]).toHaveTextContent('Test Property 2');
    });

    it('should sort by issues count when issues column is clicked', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      const issuesHeader = screen.getByText('이슈').closest('th');
      fireEvent.click(issuesHeader);

      const rows = screen.getAllByRole('row');
      // Properties with 0 issues should come first
      expect(rows[1]).toHaveTextContent('Test Property 1');

      // Click again for descending
      fireEvent.click(issuesHeader);
      const rowsDesc = screen.getAllByRole('row');
      // Property with 2 issues should come first
      expect(rowsDesc[1]).toHaveTextContent('Test Property 2');
    });

    it('should show correct sort icon for active column', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      // By default, property name column should be sorted
      const propertyHeader = screen.getByText('프로퍼티').closest('th');
      expect(propertyHeader).toHaveClass('sortable');
    });
  });

  describe('Results Summary', () => {
    it('should display total results count', () => {
      render(<ResultsTable results={mockResults} loading={false} error={null} />);

      expect(screen.getByText('총 3개의 프로퍼티 검증 결과')).toBeInTheDocument();
    });

    it('should update count when results change', () => {
      const { rerender } = render(
        <ResultsTable results={mockResults} loading={false} error={null} />
      );

      expect(screen.getByText('총 3개의 프로퍼티 검증 결과')).toBeInTheDocument();

      // Update with fewer results
      rerender(<ResultsTable results={[mockResults[0]]} loading={false} error={null} />);

      expect(screen.getByText('총 1개의 프로퍼티 검증 결과')).toBeInTheDocument();
    });
  });
});
