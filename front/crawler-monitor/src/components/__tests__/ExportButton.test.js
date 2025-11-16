/**
 * Unit Tests for ExportButton Component - Story 9.4 Task 4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExportButton from '../ExportButton';
import * as dataUtils from '../../utils/dataUtils';
import * as toast from '../../utils/toast';

// Mock modules
jest.mock('../../utils/dataUtils');
jest.mock('../../utils/toast');

describe('ExportButton Component', () => {
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
      issues: [{ type: 'mismatch', field: 'ga4_id' }],
      screenshot_url: 'https://example.com/screenshot2.png',
    },
  ];

  const mockAllResults = [
    ...mockResults,
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
      screenshot_url: 'https://example.com/screenshot3.png',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    dataUtils.downloadCSV.mockImplementation(() => {});
    toast.showToast.mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('should render export button', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockAllResults}
          runId="test-run-123"
        />
      );

      expect(screen.getByText('내보내기')).toBeInTheDocument();
    });

    it('should be disabled when no results', () => {
      render(
        <ExportButton
          results={[]}
          allResults={[]}
          runId="test-run-123"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockAllResults}
          runId="test-run-123"
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should show dropdown arrow when filtered results differ from all results', () => {
      render(
        <ExportButton
          results={mockResults.slice(0, 1)} // Only 1 result
          allResults={mockAllResults} // 3 results
          runId="test-run-123"
        />
      );

      // Button should be visible
      expect(screen.getByText('내보내기')).toBeInTheDocument();
    });
  });

  describe('Export Functionality - Single Option', () => {
    it('should show single menu option when results equal allResults', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockResults}
          runId="test-run-123"
        />
      );

      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      expect(screen.getByText('결과 내보내기')).toBeInTheDocument();
      expect(screen.getByText(`(${mockResults.length}개)`)).toBeInTheDocument();
    });

    it('should export results when single option clicked', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockResults}
          runId="test-run-123"
        />
      );

      // Open menu
      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      // Click export option
      const exportOption = screen.getByText('결과 내보내기');
      fireEvent.click(exportOption);

      // Should call downloadCSV
      expect(dataUtils.downloadCSV).toHaveBeenCalled();

      // Should show success toast
      expect(toast.showToast).toHaveBeenCalledWith(
        expect.stringContaining('필터링된 결과'),
        'success'
      );
    });
  });

  describe('Export Functionality - Multiple Options', () => {
    it('should show both options when results differ from allResults', () => {
      render(
        <ExportButton
          results={mockResults.slice(0, 1)}
          allResults={mockAllResults}
          runId="test-run-123"
        />
      );

      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      expect(screen.getByText('필터링된 결과')).toBeInTheDocument();
      expect(screen.getByText('전체 결과')).toBeInTheDocument();
      expect(screen.getByText('(1개)')).toBeInTheDocument();
      expect(screen.getByText('(3개)')).toBeInTheDocument();
    });

    it('should export filtered results when filtered option clicked', () => {
      const filteredResults = mockResults.slice(0, 1);

      render(
        <ExportButton
          results={filteredResults}
          allResults={mockAllResults}
          runId="test-run-123"
        />
      );

      // Open menu
      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      // Click filtered option
      const filteredOption = screen.getByText('필터링된 결과');
      fireEvent.click(filteredOption);

      // Should call downloadCSV with filtered results
      expect(dataUtils.downloadCSV).toHaveBeenCalled();
      const callArgs = dataUtils.downloadCSV.mock.calls[0];
      expect(callArgs[0]).toHaveLength(1); // Formatted data should have 1 item

      // Should show success toast
      expect(toast.showToast).toHaveBeenCalledWith(
        '필터링된 결과 1개가 내보내기되었습니다',
        'success'
      );
    });

    it('should export all results when all results option clicked', () => {
      render(
        <ExportButton
          results={mockResults.slice(0, 1)}
          allResults={mockAllResults}
          runId="test-run-123"
        />
      );

      // Open menu
      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      // Click all results option
      const allOption = screen.getByText('전체 결과');
      fireEvent.click(allOption);

      // Should call downloadCSV with all results
      expect(dataUtils.downloadCSV).toHaveBeenCalled();
      const callArgs = dataUtils.downloadCSV.mock.calls[0];
      expect(callArgs[0]).toHaveLength(3); // Formatted data should have 3 items

      // Should show success toast
      expect(toast.showToast).toHaveBeenCalledWith(
        '전체 결과 3개가 내보내기되었습니다',
        'success'
      );
    });
  });

  describe('CSV Formatting', () => {
    it('should format results correctly for CSV export', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockResults}
          runId="test-run-123"
        />
      );

      // Open menu and click export
      const button = screen.getByText('내보내기');
      fireEvent.click(button);
      const exportOption = screen.getByText('결과 내보내기');
      fireEvent.click(exportOption);

      // Check formatted data structure
      const callArgs = dataUtils.downloadCSV.mock.calls[0];
      const formattedData = callArgs[0];

      expect(formattedData[0]).toHaveProperty('Property Name');
      expect(formattedData[0]).toHaveProperty('URL');
      expect(formattedData[0]).toHaveProperty('Status');
      expect(formattedData[0]).toHaveProperty('GA4 Expected');
      expect(formattedData[0]).toHaveProperty('GA4 Actual');
      expect(formattedData[0]).toHaveProperty('GA4 Match');
      expect(formattedData[0]).toHaveProperty('GTM Expected');
      expect(formattedData[0]).toHaveProperty('GTM Actual');
      expect(formattedData[0]).toHaveProperty('GTM Match');
      expect(formattedData[0]).toHaveProperty('Issues Count');
      expect(formattedData[0]).toHaveProperty('Screenshot URL');

      // Check values
      expect(formattedData[0]['Property Name']).toBe('Test Property 1');
      expect(formattedData[0]['GA4 Match']).toBe('Yes');
      expect(formattedData[1]['GA4 Match']).toBe('No');
    });

    it('should include timestamp in filename', () => {
      render(
        <ExportButton
          results={mockResults}
          allResults={mockResults}
          runId="test-run-123"
        />
      );

      // Open menu and click export
      const button = screen.getByText('내보내기');
      fireEvent.click(button);
      const exportOption = screen.getByText('결과 내보내기');
      fireEvent.click(exportOption);

      // Check filename includes runId and timestamp
      const callArgs = dataUtils.downloadCSV.mock.calls[0];
      const filename = callArgs[1];
      expect(filename).toContain('test-run-123');
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/); // Date pattern
    });
  });

  describe('Error Handling', () => {
    it('should show warning toast when no results to export', () => {
      render(
        <ExportButton
          results={[]}
          allResults={[]}
          runId="test-run-123"
        />
      );

      // Button should be disabled, but if somehow clicked
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should handle export errors gracefully', () => {
      dataUtils.downloadCSV.mockImplementation(() => {
        throw new Error('Export failed');
      });

      render(
        <ExportButton
          results={mockResults}
          allResults={mockResults}
          runId="test-run-123"
        />
      );

      // Open menu and click export
      const button = screen.getByText('내보내기');
      fireEvent.click(button);
      const exportOption = screen.getByText('결과 내보내기');
      fireEvent.click(exportOption);

      // Should show error toast
      expect(toast.showToast).toHaveBeenCalledWith(
        'CSV 내보내기에 실패했습니다',
        'error'
      );
    });
  });

  describe('Menu Interactions', () => {
    it('should close menu after export', async () => {
      render(
        <ExportButton
          results={mockResults.slice(0, 1)}
          allResults={mockAllResults}
          runId="test-run-123"
        />
      );

      // Open menu
      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      expect(screen.getByText('필터링된 결과')).toBeInTheDocument();

      // Click export option
      const filteredOption = screen.getByText('필터링된 결과');
      fireEvent.click(filteredOption);

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText('필터링된 결과')).not.toBeInTheDocument();
      });
    });

    it('should close menu when clicking outside', () => {
      render(
        <div>
          <ExportButton
            results={mockResults.slice(0, 1)}
            allResults={mockAllResults}
            runId="test-run-123"
          />
          <div data-testid="outside">Outside</div>
        </div>
      );

      // Open menu
      const button = screen.getByText('내보내기');
      fireEvent.click(button);

      expect(screen.getByText('필터링된 결과')).toBeInTheDocument();

      // Click outside
      const outside = screen.getByTestId('outside');
      fireEvent.mouseDown(outside);

      // Menu should close
      expect(screen.queryByText('필터링된 결과')).not.toBeInTheDocument();
    });
  });
});
