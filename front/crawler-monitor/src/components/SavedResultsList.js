import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SavedResultCard from './SavedResultCard';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';
import './SavedResultsList.css';

/**
 * SavedResultsList Component
 *
 * Displays a grid of saved results with pagination
 *
 * Props:
 * - results: array - List of saved results
 * - loading: boolean - Loading state
 * - pagination: object - { page, limit, total }
 * - onPageChange: function - Callback for page change
 * - onViewDetail: function - Callback for viewing details
 * - onExport: function - Callback for exporting
 * - onDelete: function - Callback for deletion
 * - onMemoUpdate: function - Callback for memo updates
 * - compareMode: boolean - Whether compare mode is active
 * - selectedForCompare: array - IDs of results selected for comparison
 * - onToggleCompare: function - Callback for compare selection
 */
const SavedResultsList = ({
  results = [],
  loading = false,
  pagination = { page: 1, limit: 10, total: 0 },
  onPageChange,
  onViewDetail,
  onExport,
  onDelete,
  onMemoUpdate,
  compareMode = false,
  selectedForCompare = [],
  onToggleCompare
}) => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const hasResults = results.length > 0;

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      onPageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < totalPages) {
      onPageChange(pagination.page + 1);
    }
  };

  if (loading) {
    return (
      <div className="saved-results-list loading">
        <LoadingSpinner />
        <p className="loading-text">저장된 결과를 불러오는 중...</p>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="saved-results-list">
        <EmptyState
          title="저장된 결과가 없습니다"
          subtitle="Reports 페이지에서 크롤링 결과를 저장하세요"
        />
      </div>
    );
  }

  return (
    <div className="saved-results-list">
      <div className="results-grid">
        {results.map((result) => {
          const isSelected = selectedForCompare.includes(result.id);
          const compareDisabled =
            compareMode &&
            selectedForCompare.length >= 2 &&
            !isSelected;

          return (
            <SavedResultCard
              key={result.id}
              result={result}
              onViewDetail={onViewDetail}
              onExport={onExport}
              onDelete={onDelete}
              onMemoUpdate={onMemoUpdate}
              compareMode={compareMode}
              isSelected={isSelected}
              onToggleCompare={onToggleCompare}
              compareDisabled={compareDisabled}
            />
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={handlePrevPage}
            disabled={pagination.page === 1}
            title="이전 페이지"
          >
            <ChevronLeft size={20} />
            이전
          </button>

          <div className="pagination-info">
            <span className="page-numbers">
              {pagination.page} / {totalPages}
            </span>
            <span className="total-count">
              총 {pagination.total}개
            </span>
          </div>

          <button
            className="pagination-btn"
            onClick={handleNextPage}
            disabled={pagination.page === totalPages}
            title="다음 페이지"
          >
            다음
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedResultsList;
