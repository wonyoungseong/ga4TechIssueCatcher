/**
 * Reports Page - Story 9.4
 *
 * Displays crawl run history and detailed validation results.
 * Provides filtering, sorting, export functionality, and save results.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiHelpers } from '../utils/api';
import { handleApiError } from '../utils/errors';
import { showToast } from '../utils/toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RunsList from '../components/RunsList';
import RunDetailModal from '../components/RunDetailModal';
import RunsFilter from '../components/RunsFilter';
import Pagination from '../components/Pagination';
import SaveResultModal from '../components/SaveResultModal';
import './Reports.css';

function Reports() {
  const navigate = useNavigate();
  const { runId } = useParams();

  // State management - Task 1
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    dateRange: { start: null, end: null },
    status: 'all',
    hasIssues: 'all',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  // State management - Task 2
  const [allResults, setAllResults] = useState([]); // Task 4: Store all unfiltered results
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null);

  // State management - Task 6
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State for run detail modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  /**
   * Task 1.1: API Integration - Fetch crawl runs
   */
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: ((pagination.page - 1) * pagination.limit).toString()
      });

      // Add date range filters if set
      if (filters.dateRange.start) {
        params.append('start_date', filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        params.append('end_date', filters.dateRange.end);
      }

      // Add status filter if not 'all'
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }

      // Add has_issues filter if not 'all'
      if (filters.hasIssues !== 'all') {
        params.append('has_issues', filters.hasIssues);
      }

      // Add search filter if present
      if (filters.search && filters.search.trim()) {
        params.append('search', filters.search.trim());
      }

      const response = await apiHelpers.getCrawlRuns(params);

      if (response.success && response.data) {
        // API returns data as array directly, or wrapped in runs property
        const runs = Array.isArray(response.data) ? response.data : (response.data.runs || []);
        const total = response.count || response.data.total || 0;

        setRuns(runs);
        setPagination(prev => ({
          ...prev,
          total
        }));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const error = handleApiError(err);
      setError(error.message);
      showToast(error.message, 'error');
      console.error('[Reports] Failed to fetch runs:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  /**
   * Effect: Fetch runs on mount and when filters/pagination change
   */
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  /**
   * Task 2.1: API Integration - Fetch run results
   * Task 4: Fetch all results without filters for export functionality
   */
  const fetchRunResults = useCallback(async (runId) => {
    if (!runId) return;

    setResultsLoading(true);
    setResultsError(null);

    try {
      // Task 4: Fetch all results without filters
      const params = new URLSearchParams();
      const response = await apiHelpers.getCrawlRunResults(runId, params);

      if (response.success && response.data) {
        setAllResults(response.data.results || []);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const error = handleApiError(err);
      setResultsError(error.message);
      showToast(error.message, 'error');
      console.error('[Reports] Failed to fetch run results:', error);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  /**
   * Task 4: Client-side filtering of results
   */
  const filteredResults = useMemo(() => {
    if (!allResults || allResults.length === 0) return [];

    return allResults.filter(result => {
      // CRITICAL: Exclude inactive properties (not debugging targets)
      // If is_active is false in status management, completely hide from display
      if (result.properties?.is_active === false) {
        return false;
      }

      // Filter by issues
      if (filters.hasIssues !== 'all') {
        const hasIssues = result.issues && result.issues.length > 0;
        if (filters.hasIssues === 'issues' && !hasIssues) return false;
        if (filters.hasIssues === 'no-issues' && hasIssues) return false;
      }

      // Filter by search (property name or URL)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const propertyMatch = result.property_name?.toLowerCase().includes(searchLower);
        const urlMatch = result.url?.toLowerCase().includes(searchLower);
        if (!propertyMatch && !urlMatch) return false;
      }

      return true;
    });
  }, [allResults, filters.hasIssues, filters.search]);

  /**
   * Effect: Fetch run results when selected run changes
   */
  useEffect(() => {
    if (selectedRun) {
      fetchRunResults(selectedRun.id);
    } else {
      setAllResults([]);
      setResultsError(null);
    }
  }, [selectedRun, fetchRunResults]);

  /**
   * Effect: Handle URL runId param
   */
  useEffect(() => {
    if (runId && runs.length > 0) {
      const run = runs.find(r => r.id === runId);
      if (run) {
        setSelectedRun(run);
      }
    }
  }, [runId, runs]);

  /**
   * Handle run selection
   */
  const handleSelectRun = (run) => {
    setSelectedRun(run);
    setIsDetailModalOpen(true);
    navigate(`/reports/${run.id}`);
  };

  /**
   * Handle detail modal close
   */
  const handleDetailModalClose = () => {
    setIsDetailModalOpen(false);
    setSelectedRun(null);
    navigate('/reports');
  };

  /**
   * Task 1.3: Handle page change
   */
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Task 3.3: Handle filter change
   */
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Task 3.4: Handle filter reset
   */
  const handleFilterReset = useCallback(() => {
    setFilters({
      dateRange: { start: null, end: null },
      status: 'all',
      hasIssues: 'all',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /**
   * Task 6.1: Handle save result button click
   */
  const handleSaveClick = () => {
    setIsSaveModalOpen(true);
  };

  /**
   * Task 6.2: Handle save result
   */
  const handleSaveResult = async (memo) => {
    if (!selectedRun) return;

    setIsSaving(true);

    try {
      const response = await apiHelpers.saveCrawlRun(selectedRun.id, { memo });

      if (response.success) {
        showToast(
          <div>
            <div>결과가 저장되었습니다</div>
            <button
              onClick={() => navigate('/saved-results')}
              style={{
                marginTop: '8px',
                padding: '4px 12px',
                background: 'white',
                color: 'var(--success-text)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Saved Results 페이지로 이동 →
            </button>
          </div>,
          'success',
          5000
        );
        setIsSaveModalOpen(false);
      } else {
        throw new Error('Failed to save result');
      }
    } catch (err) {
      const error = handleApiError(err);
      showToast(error.message, 'error');
      console.error('[Reports] Failed to save result:', error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Task 6.1: Handle save modal close
   */
  const handleSaveModalClose = () => {
    if (!isSaving) {
      setIsSaveModalOpen(false);
    }
  };

  /**
   * Task 1.4: Render loading state
   */
  if (loading) {
    return (
      <div className="reports-page">
        <div className="reports-header">
          <h1>리포트</h1>
          <p className="reports-subtitle">크롤링 실행 목록 및 검증 결과</p>
        </div>
        <div className="reports-loading">
          <LoadingSpinner size="large" text="크롤링 실행 목록을 불러오는 중..." />
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && runs.length === 0) {
    return (
      <div className="reports-page">
        <div className="reports-header">
          <h1>리포트</h1>
          <p className="reports-subtitle">크롤링 실행 목록 및 검증 결과</p>
        </div>
        <EmptyState
          icon="⚠️"
          title="데이터를 불러올 수 없습니다"
          description={error}
          action={
            <button onClick={fetchRuns} className="btn-primary">
              다시 시도
            </button>
          }
        />
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!loading && runs.length === 0) {
    return (
      <div className="reports-page">
        <div className="reports-header">
          <h1>리포트</h1>
          <p className="reports-subtitle">크롤링 실행 목록 및 검증 결과</p>
        </div>
        <EmptyState
          icon="📊"
          title="크롤링 실행 기록이 없습니다"
          description="크롤링을 실행하면 여기에 결과가 표시됩니다"
          action={
            <button onClick={() => navigate('/dashboard')} className="btn-primary">
              대시보드로 이동
            </button>
          }
        />
      </div>
    );
  }

  /**
   * Main render
   */
  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <h1>리포트</h1>
        <p className="reports-subtitle">
          최근 {pagination.total}개의 크롤링 실행 기록
        </p>
      </div>

      {/* Task 3: Filters */}
      <RunsFilter
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleFilterReset}
      />

      {/* Task 1.2: Runs List */}
      <div className="reports-content">
        <RunsList
          runs={runs}
          selectedRun={selectedRun}
          onSelectRun={handleSelectRun}
        />
      </div>

      {/* Run Detail Modal */}
      <RunDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleDetailModalClose}
        selectedRun={selectedRun}
        filteredResults={filteredResults}
        allResults={allResults}
        resultsLoading={resultsLoading}
        resultsError={resultsError}
        onRetry={() => selectedRun && fetchRunResults(selectedRun.id)}
        onSaveClick={handleSaveClick}
      />

      {/* Task 1.3: Pagination */}
      {pagination.total > pagination.limit && (
        <div className="reports-pagination">
          <Pagination
            currentPage={pagination.page}
            totalPages={Math.ceil(pagination.total / pagination.limit)}
            onPageChange={handlePageChange}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
          />
        </div>
      )}

      {/* Task 6: Save Result Modal */}
      <SaveResultModal
        isOpen={isSaveModalOpen}
        onClose={handleSaveModalClose}
        onSave={handleSaveResult}
        runInfo={selectedRun}
        isSaving={isSaving}
      />
    </div>
  );
}

export default Reports;
