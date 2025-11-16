/**
 * ResultsTable Component - Story 9.4 Task 2.2
 *
 * Displays property-level validation results in a sortable table format.
 * Integrates ValidationBadge for GA4/GTM ID validation display.
 * Task 5: Integrates IssueDetailModal for detailed issue information.
 */

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import ValidationBadge from './ValidationBadge';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import ExportButton from './ExportButton';
import IssueDetailModal from './IssueDetailModal';
import { calculateHasIssues, getPropertyDisplayStatus } from '../utils/propertyStatusUtils';
import './ResultsTable.css';

function ResultsTable({ results, allResults, runId, loading, error, onRetry }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'property_name',
    direction: 'asc'
  });

  // Task 5: Modal state for issue details
  const [selectedResult, setSelectedResult] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Handle column sort
   */
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  /**
   * Sort results based on current sort configuration
   */
  const sortedResults = useMemo(() => {
    if (!results || results.length === 0) return [];

    const sorted = [...results].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'property_name':
          aValue = a.property_name || '';
          bValue = b.property_name || '';
          break;
        case 'status':
          // Sort by priority (1 = highest priority)
          const statusA = getPropertyDisplayStatus(
            a.properties?.current_status || a.property_status,
            calculateHasIssues(a),
            a.issues?.length || 0
          );
          const statusB = getPropertyDisplayStatus(
            b.properties?.current_status || b.property_status,
            calculateHasIssues(b),
            b.issues?.length || 0
          );
          aValue = statusA.priority;
          bValue = statusB.priority;
          break;
        case 'ga4_id':
          // Sort by actual GA4 ID (from validation)
          aValue = (a.ga4_validation?.actual || '').toLowerCase();
          bValue = (b.ga4_validation?.actual || '').toLowerCase();
          break;
        case 'gtm_id':
          // Sort by actual GTM ID (from validation)
          aValue = (a.gtm_validation?.actual || '').toLowerCase();
          bValue = (b.gtm_validation?.actual || '').toLowerCase();
          break;
        case 'issues':
          aValue = (a.issues || []).length;
          bValue = (b.issues || []).length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [results, sortConfig]);

  /**
   * Render sort icon
   */
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={16} />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />;
  };

  /**
   * Task 5: Handle row click to open detail modal
   */
  const handleRowClick = (result) => {
    setSelectedResult(result);
    setIsModalOpen(true);
  };

  /**
   * Task 5: Close modal
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedResult(null);
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <div className="results-table-container">
        <LoadingSpinner size="large" text="검증 결과를 불러오는 중..." />
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="results-table-container">
        <EmptyState
          icon="⚠️"
          title="결과를 불러올 수 없습니다"
          description={error}
          action={
            onRetry && (
              <button onClick={onRetry} className="btn-primary">
                다시 시도
              </button>
            )
          }
        />
      </div>
    );
  }

  /**
   * Empty state
   */
  if (!results || results.length === 0) {
    return (
      <div className="results-table-container">
        <EmptyState
          icon="📊"
          title="검증 결과가 없습니다"
          description="이 실행에 대한 프로퍼티 검증 결과가 없습니다"
        />
      </div>
    );
  }

  /**
   * Main render
   */
  return (
    <div className="results-table-container">
      {/* Task 4: Export Button Header */}
      <div className="results-table-header">
        <div className="results-summary">
          <span className="results-count">
            총 {sortedResults.length}개 결과
          </span>
        </div>
        <ExportButton
          results={sortedResults}
          allResults={allResults}
          runId={runId}
        />
      </div>

      <div className="results-table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              <th
                className="sortable"
                onClick={() => handleSort('property_name')}
              >
                <div className="th-content">
                  <span>프로퍼티</span>
                  {renderSortIcon('property_name')}
                </div>
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('status')}
              >
                <div className="th-content">
                  <span>상태</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('ga4_id')}
              >
                <div className="th-content">
                  <span>GA4 ID</span>
                  {renderSortIcon('ga4_id')}
                </div>
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('gtm_id')}
              >
                <div className="th-content">
                  <span>GTM ID</span>
                  {renderSortIcon('gtm_id')}
                </div>
              </th>
              <th
                className="sortable"
                onClick={() => handleSort('issues')}
              >
                <div className="th-content">
                  <span>이슈</span>
                  {renderSortIcon('issues')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => (
              <tr
                key={result.id || index}
                onClick={() => handleRowClick(result)}
                className="clickable-row"
              >
                {/* Property Name */}
                <td className="property-name" title={result.property_name || 'N/A'}>
                  {result.property_name || 'N/A'}
                </td>

                {/* Status - Scenario-based display */}
                <td className="status-cell">
                  {(() => {
                    const displayStatus = getPropertyDisplayStatus(
                      result.properties?.current_status || result.property_status,
                      calculateHasIssues(result),
                      result.issues?.length || 0
                    );
                    return (
                      <div className="status-display">
                        <span className={`status-badge status-${displayStatus.colorClass} ${displayStatus.blink ? 'blink-animation' : ''}`}>
                          <span className="status-icon">{displayStatus.icon}</span>
                          <span className="status-label">{displayStatus.shortLabel}</span>
                        </span>
                        {displayStatus.needsAction && (
                          <span className="action-indicator" title={displayStatus.actionLabel}>
                            ⚠️
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>

                {/* GA4 ID Validation - Task 2.3 */}
                <td className="validation-cell">
                  {result.ga4_validation ? (
                    <ValidationBadge
                      expected={result.ga4_validation.expected}
                      actual={result.ga4_validation.actual}
                      type="compact"
                      label="GA4"
                    />
                  ) : (
                    <span className="no-data">-</span>
                  )}
                </td>

                {/* GTM ID Validation - Task 2.3 */}
                <td className="validation-cell">
                  {result.gtm_validation ? (
                    <ValidationBadge
                      expected={result.gtm_validation.expected}
                      actual={result.gtm_validation.actual}
                      type="compact"
                      label="GTM"
                    />
                  ) : (
                    <span className="no-data">-</span>
                  )}
                </td>

                {/* Issues */}
                <td className="issues-cell">
                  {result.issues && result.issues.length > 0 ? (
                    <div className="issues-badge">
                      <AlertCircle size={16} />
                      <span>{result.issues.length}</span>
                    </div>
                  ) : (
                    <span className="no-issues">없음</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results summary */}
      <div className="results-summary">
        총 {sortedResults.length}개의 프로퍼티 검증 결과
      </div>

      {/* Task 5: Issue Detail Modal */}
      <IssueDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        result={selectedResult}
      />
    </div>
  );
}

ResultsTable.propTypes = {
  results: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      property_name: PropTypes.string,
      url: PropTypes.string,
      validation_status: PropTypes.string,
      ga4_validation: PropTypes.shape({
        expected: PropTypes.string,
        actual: PropTypes.string,
      }),
      gtm_validation: PropTypes.shape({
        expected: PropTypes.string,
        actual: PropTypes.string,
      }),
      issues: PropTypes.array,
      screenshot_path: PropTypes.string,
    })
  ),
  allResults: PropTypes.arrayOf(PropTypes.object),
  runId: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

ResultsTable.defaultProps = {
  results: [],
  allResults: null,
  runId: null,
  loading: false,
  error: null,
  onRetry: null,
};

export default ResultsTable;
