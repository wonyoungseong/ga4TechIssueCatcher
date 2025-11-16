/**
 * Unit Tests for RunsFilter Component - Story 9.4 Task 3
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RunsFilter from '../RunsFilter';

describe('RunsFilter Component', () => {
  const defaultFilters = {
    dateRange: { start: null, end: null },
    status: 'all',
    hasIssues: 'all',
    search: '',
  };

  const mockOnFilterChange = jest.fn();
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all filter sections', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('필터')).toBeInTheDocument();
      expect(screen.getByText('날짜 범위')).toBeInTheDocument();
      expect(screen.getByText('상태')).toBeInTheDocument();
      expect(screen.getByText('이슈')).toBeInTheDocument();
      expect(screen.getByText('검색')).toBeInTheDocument();
    });

    it('should render date preset buttons', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('오늘')).toBeInTheDocument();
      expect(screen.getByText('최근 7일')).toBeInTheDocument();
      expect(screen.getByText('최근 30일')).toBeInTheDocument();
    });

    it('should render date input fields', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByLabelText('시작일')).toBeInTheDocument();
      expect(screen.getByLabelText('종료일')).toBeInTheDocument();
    });

    it('should render status filter dropdown with all options', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const statusSelect = screen.getByLabelText('상태');
      expect(statusSelect).toBeInTheDocument();
      expect(statusSelect).toHaveValue('all');

      // Check options exist
      const options = within(statusSelect).getAllByRole('option');
      expect(options).toHaveLength(4); // all, completed, running, failed
    });

    it('should render issues filter dropdown with all options', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const issuesSelect = screen.getByLabelText('이슈');
      expect(issuesSelect).toBeInTheDocument();
      expect(issuesSelect).toHaveValue('all');
    });

    it('should render search input with placeholder', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const searchInput = screen.getByPlaceholderText('프로퍼티명 또는 URL로 검색');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveValue('');
    });

    it('should not show reset button when no filters are active', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.queryByText('초기화')).not.toBeInTheDocument();
    });

    it('should show reset button when filters are active', () => {
      const activeFilters = {
        ...defaultFilters,
        status: 'completed',
      };

      render(
        <RunsFilter
          filters={activeFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('초기화')).toBeInTheDocument();
    });
  });

  describe('Date Preset Functionality', () => {
    it('should set today when "오늘" button is clicked', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const todayButton = screen.getByText('오늘');
      fireEvent.click(todayButton);

      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);

      const call = mockOnFilterChange.mock.calls[0][0];
      expect(call.dateRange.start).toBeTruthy();
      expect(call.dateRange.end).toBeTruthy();

      // Verify start is today's date
      const today = new Date().toISOString().split('T')[0];
      expect(call.dateRange.start).toBe(today);

      // End should be today or tomorrow (depending on timezone/timing)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect([today, tomorrow]).toContain(call.dateRange.end);
    });

    it('should set last 7 days when "최근 7일" button is clicked', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const sevenDaysButton = screen.getByText('최근 7일');
      fireEvent.click(sevenDaysButton);

      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);

      const call = mockOnFilterChange.mock.calls[0][0];
      expect(call.dateRange.start).toBeTruthy();
      expect(call.dateRange.end).toBeTruthy();

      // Verify date range is approximately 7-8 days (accounting for inclusive end date)
      const start = new Date(call.dateRange.start);
      const end = new Date(call.dateRange.end);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(7);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('should set last 30 days when "최근 30일" button is clicked', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const thirtyDaysButton = screen.getByText('최근 30일');
      fireEvent.click(thirtyDaysButton);

      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);

      const call = mockOnFilterChange.mock.calls[0][0];
      expect(call.dateRange.start).toBeTruthy();
      expect(call.dateRange.end).toBeTruthy();

      // Verify date range is approximately 30-31 days (accounting for inclusive end date)
      const start = new Date(call.dateRange.start);
      const end = new Date(call.dateRange.end);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe('Manual Date Input', () => {
    it('should handle start date change', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const startDateInput = screen.getByLabelText('시작일');
      fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        dateRange: {
          ...defaultFilters.dateRange,
          start: '2025-01-01',
        },
      });
    });

    it('should handle end date change', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const endDateInput = screen.getByLabelText('종료일');
      fireEvent.change(endDateInput, { target: { value: '2025-12-31' } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        dateRange: {
          ...defaultFilters.dateRange,
          end: '2025-12-31',
        },
      });
    });

    it('should display selected dates in inputs', () => {
      const filtersWithDates = {
        ...defaultFilters,
        dateRange: { start: '2025-01-01', end: '2025-12-31' },
      };

      render(
        <RunsFilter
          filters={filtersWithDates}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByLabelText('시작일')).toHaveValue('2025-01-01');
      expect(screen.getByLabelText('종료일')).toHaveValue('2025-12-31');
    });
  });

  describe('Status Filter', () => {
    it('should handle status filter change', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const statusSelect = screen.getByLabelText('상태');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        status: 'completed',
      });
    });

    it('should display selected status', () => {
      const filtersWithStatus = {
        ...defaultFilters,
        status: 'failed',
      };

      render(
        <RunsFilter
          filters={filtersWithStatus}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByLabelText('상태')).toHaveValue('failed');
    });
  });

  describe('Issues Filter', () => {
    it('should handle issues filter change', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const issuesSelect = screen.getByLabelText('이슈');
      fireEvent.change(issuesSelect, { target: { value: 'issues' } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        hasIssues: 'issues',
      });
    });

    it('should display selected issues filter', () => {
      const filtersWithIssues = {
        ...defaultFilters,
        hasIssues: 'no-issues',
      };

      render(
        <RunsFilter
          filters={filtersWithIssues}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByLabelText('이슈')).toHaveValue('no-issues');
    });
  });

  describe('Search Filter', () => {
    it('should handle search input change', () => {
      render(
        <RunsFilter
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const searchInput = screen.getByPlaceholderText('프로퍼티명 또는 URL로 검색');
      fireEvent.change(searchInput, { target: { value: 'test property' } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        search: 'test property',
      });
    });

    it('should display search value', () => {
      const filtersWithSearch = {
        ...defaultFilters,
        search: 'example search',
      };

      render(
        <RunsFilter
          filters={filtersWithSearch}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const searchInput = screen.getByPlaceholderText('프로퍼티명 또는 URL로 검색');
      expect(searchInput).toHaveValue('example search');
    });
  });

  describe('Reset Functionality', () => {
    it('should call onReset when reset button is clicked', () => {
      const activeFilters = {
        dateRange: { start: '2025-01-01', end: '2025-12-31' },
        status: 'completed',
        hasIssues: 'issues',
        search: 'test',
      };

      render(
        <RunsFilter
          filters={activeFilters}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      const resetButton = screen.getByText('초기화');
      fireEvent.click(resetButton);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should show reset button when date range is set', () => {
      const filtersWithDate = {
        ...defaultFilters,
        dateRange: { start: '2025-01-01', end: null },
      };

      render(
        <RunsFilter
          filters={filtersWithDate}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('초기화')).toBeInTheDocument();
    });

    it('should show reset button when search is active', () => {
      const filtersWithSearch = {
        ...defaultFilters,
        search: 'test',
      };

      render(
        <RunsFilter
          filters={filtersWithSearch}
          onFilterChange={mockOnFilterChange}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('초기화')).toBeInTheDocument();
    });
  });
});

// Import within to fix scope issue
import { within } from '@testing-library/react';
