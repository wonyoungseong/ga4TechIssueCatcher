import React, { useState, useEffect } from 'react';
import { GitCompare, RefreshCw } from 'lucide-react';
import { apiHelpers } from '../utils/api';
import { showToast } from '../utils/toast';
import { convertToCSV, downloadFile } from '../utils/dataUtils';
import { handleApiError } from '../utils/errors';
import SavedResultsList from '../components/SavedResultsList';
import SavedResultDetail from '../components/SavedResultDetail';
import CompareView from '../components/CompareView';
import './SavedResults.css';

/**
 * SavedResults Page
 *
 * Manage saved crawling results with features:
 * - List view with pagination
 * - Detail view
 * - Compare two results
 * - Edit memos
 * - Delete results
 * - Export to CSV
 */
const SavedResults = () => {
  // State management
  const [savedResults, setSavedResults] = useState([]);
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [selectedResultDetail, setSelectedResultDetail] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareResults, setCompareResults] = useState([null, null]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  // Fetch saved results on mount and pagination change
  useEffect(() => {
    fetchSavedResults();
  }, [pagination.page]);

  /**
   * Fetch saved results list with pagination
   */
  const fetchSavedResults = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      };

      const response = await apiHelpers.getSavedResults(params);

      if (response.success && response.data) {
        setSavedResults(response.data.results || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0
        }));
      }
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch detailed result by ID
   */
  const fetchResultDetail = async (id) => {
    setDetailLoading(true);
    try {
      const response = await apiHelpers.getSavedResultDetail(id);

      if (response.success && response.data) {
        setSelectedResultDetail(response.data);
      }
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * Handle view detail button click
   */
  const handleViewDetail = async (id) => {
    setSelectedResultId(id);
    setCompareMode(false);
    setSelectedForCompare([]);
    await fetchResultDetail(id);
  };

  /**
   * Handle close detail view
   */
  const handleCloseDetail = () => {
    setSelectedResultId(null);
    setSelectedResultDetail(null);
  };

  /**
   * Handle memo update
   */
  const handleMemoUpdate = async (id, memo) => {
    try {
      const response = await apiHelpers.updateSavedResult(id, { memo });

      if (response.success) {
        showToast('메모가 저장되었습니다', 'success');

        // Update in list
        setSavedResults(prev =>
          prev.map(r => r.id === id ? { ...r, memo } : r)
        );

        // Update detail if open
        if (selectedResultDetail && selectedResultDetail.id === id) {
          setSelectedResultDetail(prev => ({ ...prev, memo }));
        }
      }
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    }
  };

  /**
   * Handle result deletion
   */
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) {
      return;
    }

    try {
      const response = await apiHelpers.deleteSavedResult(id);

      if (response.success) {
        showToast('결과가 삭제되었습니다', 'success');

        // Remove from list
        setSavedResults(prev => prev.filter(r => r.id !== id));

        // Update total count
        setPagination(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1)
        }));

        // Close detail view if this result is open
        if (selectedResultId === id) {
          handleCloseDetail();
        }

        // Remove from compare selection if selected
        if (selectedForCompare.includes(id)) {
          setSelectedForCompare(prev => prev.filter(resultId => resultId !== id));
        }
      }
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    }
  };

  /**
   * Handle CSV export for a single result
   */
  const handleExport = async (id) => {
    try {
      const response = await apiHelpers.getSavedResultDetail(id);

      if (response.success && response.data) {
        const result = response.data;
        const results = result.results || [];

        const csvData = results.map(r => ({
          property_name: r.property_name,
          url: r.url,
          status: r.status,
          issues_count: (r.issues || []).length,
          issues_types: (r.issues || []).map(i => i.type).join('; ')
        }));

        const csv = convertToCSV(csvData, [
          'property_name',
          'url',
          'status',
          'issues_count',
          'issues_types'
        ]);

        const filename = `saved-result-${id}-${Date.now()}.csv`;
        downloadFile(csv, filename, 'text/csv');

        showToast('CSV 다운로드가 시작되었습니다', 'success');
      }
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    }
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  /**
   * Toggle compare mode
   */
  const handleToggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedForCompare([]);
    setCompareResults([null, null]);
    handleCloseDetail();
  };

  /**
   * Toggle result selection for comparison
   */
  const handleToggleCompare = (id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(resultId => resultId !== id);
      } else if (prev.length < 2) {
        return [...prev, id];
      }
      return prev;
    });
  };

  /**
   * Fetch and display comparison when 2 results selected
   */
  useEffect(() => {
    const fetchCompareResults = async () => {
      if (selectedForCompare.length === 2) {
        try {
          const [response1, response2] = await Promise.all([
            apiHelpers.getSavedResultDetail(selectedForCompare[0]),
            apiHelpers.getSavedResultDetail(selectedForCompare[1])
          ]);

          if (response1.success && response2.success) {
            setCompareResults([response1.data, response2.data]);
          }
        } catch (error) {
          const apiError = handleApiError(error);
          showToast(apiError.message, 'error');
        }
      } else {
        setCompareResults([null, null]);
      }
    };

    fetchCompareResults();
  }, [selectedForCompare]);

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    fetchSavedResults();
    showToast('목록을 새로고침했습니다', 'info');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1>저장된 결과</h1>
          <p className="page-subtitle">저장된 크롤링 결과 관리 및 비교</p>
        </div>
      </div>

      <div className="action-bar">
        <div className="left-actions">
          <button
            className={`action-btn ${compareMode ? 'active' : ''}`}
            onClick={handleToggleCompareMode}
          >
            <GitCompare size={18} />
            {compareMode ? '비교 취소' : '결과 비교'}
          </button>

          {compareMode && (
            <span className="compare-hint">
              {selectedForCompare.length === 0
                ? '2개의 결과를 선택하세요'
                : selectedForCompare.length === 1
                ? '1개 더 선택하세요'
                : '비교 가능'}
            </span>
          )}
        </div>

        <div className="right-actions">
          <button className="action-btn secondary" onClick={handleRefresh}>
            <RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </div>

      {/* Compare View */}
      {compareMode && selectedForCompare.length === 2 && compareResults[0] && compareResults[1] && (
        <CompareView
          result1={compareResults[0]}
          result2={compareResults[1]}
          onClose={handleToggleCompareMode}
        />
      )}

      {/* Detail View */}
      {selectedResultDetail && !compareMode && (
        <SavedResultDetail
          result={selectedResultDetail}
          loading={detailLoading}
          onClose={handleCloseDetail}
        />
      )}

      {/* List View */}
      <SavedResultsList
        results={savedResults}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onViewDetail={handleViewDetail}
        onExport={handleExport}
        onDelete={handleDelete}
        onMemoUpdate={handleMemoUpdate}
        compareMode={compareMode}
        selectedForCompare={selectedForCompare}
        onToggleCompare={handleToggleCompare}
      />
    </div>
  );
};

export default SavedResults;
