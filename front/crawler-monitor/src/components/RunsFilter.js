/**
 * RunsFilter Component - Story 9.4 Task 3
 *
 * Provides filtering controls for crawl runs:
 * - Date range selection with presets
 * - Status filter (all/success/failed)
 * - Issues filter (all/with issues/without issues)
 * - Property search (name/URL)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Calendar, Filter, X, Search } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import './RunsFilter.css';

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

function RunsFilter({ filters, onFilterChange, onReset }) {
  /**
   * Handle date preset selection
   * Uses KST (Asia/Seoul) timezone to ensure correct date matching
   */
  const handlePreset = (preset) => {
    // Get current date in KST timezone
    const now = dayjs().tz('Asia/Seoul');

    // End date: today 23:59:59 in KST
    const end = now.endOf('day');

    let start;

    switch (preset) {
      case 'today':
        // Start of today in KST
        start = now.startOf('day');
        break;
      case '7days':
        // 7 days ago from today in KST
        start = now.subtract(6, 'day').startOf('day');
        break;
      case '30days':
        // 30 days ago from today in KST
        start = now.subtract(29, 'day').startOf('day');
        break;
      default:
        return;
    }

    onFilterChange({
      ...filters,
      dateRange: {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      },
    });
  };

  /**
   * Handle date range change
   */
  const handleDateChange = (field, value) => {
    onFilterChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    });
  };

  /**
   * Handle status filter change
   */
  const handleStatusChange = (e) => {
    onFilterChange({
      ...filters,
      status: e.target.value,
    });
  };

  /**
   * Handle issues filter change
   */
  const handleIssuesChange = (e) => {
    onFilterChange({
      ...filters,
      hasIssues: e.target.value,
    });
  };

  /**
   * Handle search input change
   */
  const handleSearchChange = (e) => {
    onFilterChange({
      ...filters,
      search: e.target.value,
    });
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = () => {
    return (
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.status !== 'all' ||
      filters.hasIssues !== 'all' ||
      filters.search !== ''
    );
  };

  return (
    <div className="runs-filter">
      <div className="filter-header">
        <div className="filter-title">
          <Filter size={20} />
          <h3>필터</h3>
        </div>
        {hasActiveFilters() && (
          <button onClick={onReset} className="btn-reset" title="필터 초기화">
            <X size={16} />
            초기화
          </button>
        )}
      </div>

      <div className="filter-content">
        {/* Date Range Filter - Task 3.1 */}
        <div className="filter-section">
          <label className="filter-label">
            <Calendar size={16} />
            날짜 범위
          </label>

          {/* Date Presets - Task 3.2 */}
          <div className="filter-presets">
            <button
              onClick={() => handlePreset('today')}
              className="btn-preset"
            >
              오늘
            </button>
            <button
              onClick={() => handlePreset('7days')}
              className="btn-preset"
            >
              최근 7일
            </button>
            <button
              onClick={() => handlePreset('30days')}
              className="btn-preset"
            >
              최근 30일
            </button>
          </div>

          <div className="filter-date-inputs">
            <div className="date-input-group">
              <label htmlFor="start-date">시작일</label>
              <input
                id="start-date"
                type="date"
                value={filters.dateRange.start || ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="input-date"
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="end-date">종료일</label>
              <input
                id="end-date"
                type="date"
                value={filters.dateRange.end || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="input-date"
              />
            </div>
          </div>
        </div>

        {/* Status Filter - Task 3.1 */}
        <div className="filter-section">
          <label htmlFor="status-filter" className="filter-label">
            상태
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={handleStatusChange}
            className="filter-select"
          >
            <option value="all">전체</option>
            <option value="completed">완료</option>
            <option value="running">실행 중</option>
            <option value="failed">실패</option>
          </select>
        </div>

        {/* Issues Filter - Task 3.1 */}
        <div className="filter-section">
          <label htmlFor="issues-filter" className="filter-label">
            이슈
          </label>
          <select
            id="issues-filter"
            value={filters.hasIssues}
            onChange={handleIssuesChange}
            className="filter-select"
          >
            <option value="all">전체</option>
            <option value="issues">이슈 있음</option>
            <option value="no-issues">이슈 없음</option>
          </select>
        </div>

        {/* Search Filter - Task 3.1 */}
        <div className="filter-section">
          <label htmlFor="search-filter" className="filter-label">
            <Search size={16} />
            검색
          </label>
          <input
            id="search-filter"
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="프로퍼티명 또는 URL로 검색"
            className="filter-search"
          />
        </div>
      </div>
    </div>
  );
}

RunsFilter.propTypes = {
  filters: PropTypes.shape({
    dateRange: PropTypes.shape({
      start: PropTypes.string,
      end: PropTypes.string,
    }).isRequired,
    status: PropTypes.string.isRequired,
    hasIssues: PropTypes.string.isRequired,
    search: PropTypes.string.isRequired,
  }).isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};

export default RunsFilter;
