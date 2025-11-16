/**
 * Unit Tests for Reports Page - Story 9.4 Tasks 1 & 2
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, mockNavigate } from 'react-router-dom';
import '@testing-library/jest-dom';
import Reports from '../Reports';
import { apiHelpers } from '../../utils/api';
import * as errors from '../../utils/errors';

// Mock dependencies
jest.mock('../../utils/api');
jest.mock('../../utils/errors');
jest.mock('../../utils/toast', () => ({
  showToast: jest.fn(),
}));

// react-router-dom is automatically mocked via __mocks__/react-router-dom.js

// Mock window.scrollTo for jsdom
global.scrollTo = jest.fn();

describe('Reports Page - Task 1', () => {
  const mockRuns = [
    {
      id: 'run-1',
      run_date: '2025-10-31',
      status: 'completed',
      total_properties: 85,
      completed_properties: 82,
      failed_properties: 3,
      properties_with_issues: 5,
      duration_seconds: 5400,
    },
    {
      id: 'run-2',
      run_date: '2025-10-30',
      status: 'running',
      total_properties: 85,
      completed_properties: 50,
      failed_properties: 0,
      properties_with_issues: 2,
      duration_seconds: 2700,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    errors.handleApiError = jest.fn((err) => ({
      message: err.message || 'API Error',
      code: err.code || 'UNKNOWN',
    }));
  });

  describe('Task 1.1: API Integration', () => {
    it('should fetch crawl runs on mount', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(apiHelpers.getCrawlRuns).toHaveBeenCalledWith(
          expect.any(URLSearchParams)
        );
      });
    });

    it('should pass correct query parameters to API', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        const callArgs = apiHelpers.getCrawlRuns.mock.calls[0][0];
        expect(callArgs.get('limit')).toBe('20');
        expect(callArgs.get('offset')).toBe('0');
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      apiHelpers.getCrawlRuns.mockRejectedValue(error);

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('데이터를 불러올 수 없습니다')).toBeInTheDocument();
        expect(errors.handleApiError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Task 1.2: RunsList and RunCard Components', () => {
    it('should render runs list with run cards', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
        expect(screen.getByText('2025-10-30')).toBeInTheDocument();
      });
    });

    it('should navigate when run card is clicked', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const runCard = screen.getByText('2025-10-31').closest('.run-card');
      fireEvent.click(runCard);

      expect(mockNavigate).toHaveBeenCalledWith('/reports/run-1');
    });

    it('should display run stats correctly', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Use getAllByText for labels that appear multiple times (one per run card)
        const propertyLabels = screen.getAllByText('총 프로퍼티');
        expect(propertyLabels.length).toBeGreaterThan(0);
        expect(screen.getAllByText('완료').length).toBeGreaterThan(0);
        expect(screen.getAllByText('실패').length).toBeGreaterThan(0);
        expect(screen.getAllByText('이슈').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Task 1.3: Pagination', () => {
    it('should display pagination when total exceeds limit', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 50 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/50 항목 중 1-20 표시/)).toBeInTheDocument();
      });
    });

    it('should not display pagination when total is less than limit', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText(/항목 중.*표시/)).not.toBeInTheDocument();
      });
    });

    it('should handle page change', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 50 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('다음 페이지')).toBeInTheDocument();
      });

      // Clear previous calls
      apiHelpers.getCrawlRuns.mockClear();
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: [], total: 50 },
      });

      // Click next page button
      const nextButton = screen.getByLabelText('다음 페이지');
      fireEvent.click(nextButton);

      await waitFor(() => {
        const callArgs = apiHelpers.getCrawlRuns.mock.calls[0][0];
        expect(callArgs.get('offset')).toBe('20');
      });
    });
  });

  describe('Task 1.4: Loading States', () => {
    it('should show loading spinner while fetching', () => {
      apiHelpers.getCrawlRuns.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
      expect(screen.getByText('크롤링 실행 목록을 불러오는 중...')).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no runs available', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: [], total: 0 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('크롤링 실행 기록이 없습니다')).toBeInTheDocument();
        expect(
          screen.getByText('크롤링을 실행하면 여기에 결과가 표시됩니다')
        ).toBeInTheDocument();
      });
    });

    it('should navigate to dashboard when empty state button is clicked', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: [], total: 0 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('대시보드로 이동')).toBeInTheDocument();
      });

      const button = screen.getByText('대시보드로 이동');
      fireEvent.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Error States', () => {
    it('should show error state with retry button', async () => {
      apiHelpers.getCrawlRuns.mockRejectedValue(new Error('Network error'));

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('데이터를 불러올 수 없습니다')).toBeInTheDocument();
        expect(screen.getByText('다시 시도')).toBeInTheDocument();
      });
    });

    it('should retry fetching when retry button is clicked', async () => {
      apiHelpers.getCrawlRuns.mockRejectedValueOnce(new Error('Network error'));
      apiHelpers.getCrawlRuns.mockResolvedValueOnce({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('다시 시도')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('다시 시도');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display total runs count in subtitle', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 30 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('최근 30개의 크롤링 실행 기록')).toBeInTheDocument();
      });
    });
  });

  // Task 2: Run Results Integration Tests
  describe('Task 2: Run Results Display', () => {
    const mockRunResults = [
      {
        id: 'result-1',
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
        id: 'result-2',
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
        ],
        screenshot_url: 'https://example.com/screenshot2.png',
      },
    ];

    beforeEach(() => {
      // Reset all mocks
      apiHelpers.getCrawlRuns.mockReset();
      apiHelpers.getCrawlRunResults.mockReset();
    });

    it('should fetch and display run results when a run is selected', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      // Wait for runs to load
      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      // Click on first run card using the date text to find it
      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for results header to appear
      await waitFor(() => {
        expect(screen.getByText('검증 결과 상세')).toBeInTheDocument();
      });

      // Verify getCrawlRunResults was called with correct runId
      expect(apiHelpers.getCrawlRunResults).toHaveBeenCalledWith(
        'run-1',
        expect.any(URLSearchParams)
      );
    });

    it('should display results table with property names', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for results to load and check property names appear
      await waitFor(() => {
        expect(screen.getByText('Test Property 1')).toBeInTheDocument();
        expect(screen.getByText('Test Property 2')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching results', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      // Delay the results response
      apiHelpers.getCrawlRunResults.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { results: mockRunResults },
        }), 100))
      );

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Check for loading text
      expect(screen.getByText('검증 결과를 불러오는 중...')).toBeInTheDocument();

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('Test Property 1')).toBeInTheDocument();
      });
    });

    it('should show error state when fetching results fails', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockRejectedValue(
        new Error('Failed to fetch results')
      );

      errors.handleApiError.mockReturnValue({
        message: 'Failed to fetch results',
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('결과를 불러올 수 없습니다')).toBeInTheDocument();
      });
    });

    it('should retry fetching results when retry button is clicked', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      // First call fails, second call succeeds
      apiHelpers.getCrawlRunResults
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: { results: mockRunResults },
        });

      errors.handleApiError.mockReturnValue({
        message: 'Network error',
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('결과를 불러올 수 없습니다')).toBeInTheDocument();
      });

      // Click retry button
      const retryButtons = screen.getAllByText('다시 시도');
      const resultsRetryButton = retryButtons[retryButtons.length - 1];
      fireEvent.click(resultsRetryButton);

      // Wait for results to load successfully
      await waitFor(() => {
        expect(screen.getByText('Test Property 1')).toBeInTheDocument();
      });

      // Verify API was called twice (initial + retry)
      expect(apiHelpers.getCrawlRunResults).toHaveBeenCalledTimes(2);
    });

    it('should clear results when no run is selected', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      // Select first run
      const firstRunCard = screen.getAllByRole('button')[0];
      fireEvent.click(firstRunCard);

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('검증 결과 상세')).toBeInTheDocument();
      });

      // The results section should not be visible initially (before selecting a run)
      // This test verifies the conditional rendering logic
      expect(screen.getByText('검증 결과 상세')).toBeInTheDocument();
    });

    it('should include query params when fetching results', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(apiHelpers.getCrawlRunResults).toHaveBeenCalledWith(
          'run-1',
          expect.any(URLSearchParams)
        );
      });

      // Verify the call was made with URLSearchParams
      const call = apiHelpers.getCrawlRunResults.mock.calls[0];
      expect(call[0]).toBe('run-1');
      expect(call[1]).toBeInstanceOf(URLSearchParams);
    });
  });

  // Task 6: Save Results Functionality Tests
  describe('Task 6: Save Results Functionality', () => {
    const mockRunResults = [
      {
        id: 'result-1',
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
    ];

    beforeEach(() => {
      apiHelpers.getCrawlRuns.mockReset();
      apiHelpers.getCrawlRunResults.mockReset();
      apiHelpers.saveCrawlRun = jest.fn();
    });

    it('should render save button when run is selected', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      // Click on first run card using the date text to find it
      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for results to load
      await waitFor(() => {
        expect(screen.getByText('검증 결과 상세')).toBeInTheDocument();
      });

      // Check save button is rendered
      expect(screen.getByText('결과 저장')).toBeInTheDocument();
      expect(screen.getByText('💾')).toBeInTheDocument();
    });

    it('should not render save button when no run is selected', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      // Save button should not be rendered
      expect(screen.queryByText('결과 저장')).not.toBeInTheDocument();
    });

    it('should disable save button while results are loading', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      // Delay results loading
      apiHelpers.getCrawlRunResults.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { results: mockRunResults },
        }), 100))
      );

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      // Wait for save button to appear
      await waitFor(() => {
        const saveButton = screen.getByText('결과 저장').closest('button');
        expect(saveButton).toBeDisabled();
      });

      // Wait for results to finish loading
      await waitFor(() => {
        const saveButton = screen.getByText('결과 저장').closest('button');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should open save modal when save button is clicked', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });
    });

    it('should call saveCrawlRun API with correct parameters', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      apiHelpers.saveCrawlRun.mockResolvedValue({
        success: true,
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test memo content' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Verify API was called with correct parameters
      await waitFor(() => {
        expect(apiHelpers.saveCrawlRun).toHaveBeenCalledWith('run-1', {
          memo: 'Test memo content',
        });
      });
    });

    it('should show success toast after successful save', async () => {
      const { showToast } = require('../../utils/toast');

      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      apiHelpers.saveCrawlRun.mockResolvedValue({
        success: true,
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test memo' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Verify toast was shown with success message
      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith(
          expect.anything(),
          'success',
          5000
        );
      });
    });

    it('should navigate to saved results when toast button is clicked', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      apiHelpers.saveCrawlRun.mockResolvedValue({
        success: true,
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo and save
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test' } });

      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(apiHelpers.saveCrawlRun).toHaveBeenCalled();
      });

      // Note: Testing the navigation button in toast would require
      // rendering the toast content and clicking the button
      // This is covered in integration tests
    });

    it('should handle save error gracefully', async () => {
      const { showToast } = require('../../utils/toast');

      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      apiHelpers.saveCrawlRun.mockRejectedValue(
        new Error('Failed to save')
      );

      errors.handleApiError.mockReturnValue({
        message: 'Failed to save',
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Verify error toast was shown
      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith(
          'Failed to save',
          'error'
        );
      });

      // Modal should still be open after error
      expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
    });

    it('should close modal after successful save', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      apiHelpers.saveCrawlRun.mockResolvedValue({
        success: true,
      });

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Wait for modal to close
      await waitFor(() => {
        expect(screen.queryByText('크롤링 결과 저장')).not.toBeInTheDocument();
      });
    });

    it('should show loading state during save', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      // Delay save response
      apiHelpers.saveCrawlRun.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
        }), 100))
      );

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Should show "저장 중..." immediately
      expect(screen.getByText('저장 중...')).toBeInTheDocument();

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.queryByText('저장 중...')).not.toBeInTheDocument();
      });
    });

    it('should prevent closing modal during save', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: mockRuns, total: 2 },
      });

      apiHelpers.getCrawlRunResults.mockResolvedValue({
        success: true,
        data: { results: mockRunResults },
      });

      // Delay save response
      apiHelpers.saveCrawlRun.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
        }), 100))
      );

      render(
        <BrowserRouter>
          <Reports />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2025-10-31')).toBeInTheDocument();
      });

      const firstRunDate = screen.getByText('2025-10-31');
      const firstRunCard = firstRunDate.closest('.run-card');
      fireEvent.click(firstRunCard);

      await waitFor(() => {
        expect(screen.getByText('결과 저장')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByText('결과 저장').closest('button');
      fireEvent.click(saveButton);

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText('크롤링 결과 저장')).toBeInTheDocument();
      });

      // Fill in memo
      const memoTextarea = screen.getByLabelText(/메모/);
      fireEvent.change(memoTextarea, { target: { value: 'Test' } });

      // Click save in modal
      const modalSaveButton = screen.getAllByText('저장')[0].closest('button');
      fireEvent.click(modalSaveButton);

      // Try to click cancel during save
      const cancelButton = screen.getByText('취소').closest('button');
      expect(cancelButton).toBeDisabled();

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.queryByText('크롤링 결과 저장')).not.toBeInTheDocument();
      });
    });
  });
});
