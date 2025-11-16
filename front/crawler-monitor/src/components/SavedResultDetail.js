import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, FileText, CheckCircle, AlertCircle, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';
import './SavedResultDetail.css';

/**
 * SavedResultDetail Component
 *
 * Displays detailed view of a saved result including:
 * - Result summary
 * - Properties table
 * - Issues panel
 *
 * Props:
 * - result: object - Detailed saved result data
 * - loading: boolean - Loading state
 * - onClose: function - Callback to close detail view
 */
const SavedResultDetail = ({ result, loading = false, onClose }) => {
  const navigate = useNavigate();

  // Sort state - default to name ascending
  const [sortConfig, setSortConfig] = useState({
    key: 'property_name',
    direction: 'asc'
  });

  // Extract results data
  const results = result?.results || [];
  const successCount = results.filter(r => r.status === 'success').length;
  const issueCount = results.filter(r => r.status !== 'success' && r.status !== 'not_validated').length;
  const notValidatedCount = results.filter(r => r.status === 'not_validated').length;
  const totalActiveProperties = result?.total_active_properties || results.length;
  const validatedProperties = result?.validated_properties || results.length;

  /**
   * Handle property name click - navigate to property detail
   */
  const handlePropertyClick = (slug) => {
    if (slug) {
      navigate(`/properties/${slug}`);
    }
  };

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
   * Render sort icon
   */
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={14} style={{ marginLeft: '4px' }} />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} style={{ marginLeft: '4px' }} />
      : <ArrowDown size={14} style={{ marginLeft: '4px' }} />;
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
          aValue = (a.property_name || '').toLowerCase();
          bValue = (b.property_name || '').toLowerCase();
          break;
        case 'url':
          aValue = (a.url || '').toLowerCase();
          bValue = (b.url || '').toLowerCase();
          break;
        case 'status':
          // Sort by status: success < not_validated < error
          const statusOrder = { 'success': 1, 'not_validated': 2, 'error': 3 };
          aValue = statusOrder[a.status] || 99;
          bValue = statusOrder[b.status] || 99;
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

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="saved-result-detail loading">
        <LoadingSpinner />
        <p className="loading-text">결과를 불러오는 중...</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="saved-result-detail">
      <div className="detail-header">
        <div className="header-content">
          <h2>저장된 결과 상세</h2>
          <div className="header-meta">
            <div className="meta-item">
              <Calendar size={16} />
              <span>저장일: {formatDate(result.saved_at, 'YYYY-MM-DD HH:mm')}</span>
            </div>
            <div className="meta-item">
              <FileText size={16} />
              <span>크롤링 실행일: {formatDate(result.original_run_date, 'YYYY-MM-DD')}</span>
            </div>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} title="닫기">
          <X size={20} />
          닫기
        </button>
      </div>

      {result.memo && (
        <div className="detail-memo">
          <h3>메모</h3>
          <p>{result.memo}</p>
        </div>
      )}

      <div className="detail-summary">
        <div className="summary-stat">
          <div className="stat-value">{totalActiveProperties}</div>
          <div className="stat-label">전체 프로퍼티</div>
        </div>
        <div className="summary-stat success">
          <CheckCircle size={24} className="stat-icon" />
          <div className="stat-value">{successCount}</div>
          <div className="stat-label">정상</div>
        </div>
        <div className="summary-stat warning">
          <AlertCircle size={24} className="stat-icon" />
          <div className="stat-value">{issueCount}</div>
          <div className="stat-label">이슈 발견</div>
        </div>
        {notValidatedCount > 0 && (
          <div className="summary-stat info">
            <AlertCircle size={24} className="stat-icon" />
            <div className="stat-value">{notValidatedCount}</div>
            <div className="stat-label">미검증</div>
          </div>
        )}
      </div>

      <div className="detail-content">
        <h3>프로퍼티 검증 결과</h3>
        <div className="properties-table">
          <table>
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => handleSort('property_name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>프로퍼티명</span>
                    {renderSortIcon('property_name')}
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('url')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>URL</span>
                    {renderSortIcon('url')}
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>상태</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort('issues')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>이슈</span>
                    {renderSortIcon('issues')}
                  </div>
                </th>
                <th>스크린샷</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((property, index) => (
                <tr key={index} className={property.status}>
                  <td
                    className="property-name clickable"
                    onClick={() => handlePropertyClick(property.slug)}
                    title="클릭하여 프로퍼티 상세 페이지로 이동"
                    style={{ cursor: 'pointer', color: '#0066cc' }}
                  >
                    {property.property_name}
                  </td>
                  <td className="property-url">
                    <a href={property.url} target="_blank" rel="noopener noreferrer">
                      {property.url}
                      <ExternalLink size={12} />
                    </a>
                  </td>
                  <td className="property-status">
                    <span className={`status-badge ${property.status}`}>
                      {property.status === 'success' ? '정상' : property.status === 'not_validated' ? '미검증' : '실패'}
                    </span>
                  </td>
                  <td className="property-issues">
                    {property.status === 'not_validated' ? (
                      <span className="not-validated">미검증</span>
                    ) : property.issues && property.issues.length > 0 ? (
                      <div className="issues-info">
                        <span className="issues-count">{property.issues.length}개</span>
                        {property.issues[0] && (
                          <span className="issue-preview" title={property.issues[0].message}>
                            {property.issues[0].message}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="no-issues">없음</span>
                    )}
                  </td>
                  <td className="property-screenshot">
                    {property.screenshot_url ? (
                      <a href={property.screenshot_url} target="_blank" rel="noopener noreferrer">
                        보기
                      </a>
                    ) : (
                      <span className="no-screenshot">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {results.some(r => r.issues && r.issues.length > 0) && (
          <>
            <h3>발견된 이슈</h3>
            <div className="issues-panel">
              {results.map((property, pIndex) => {
                if (!property.issues || property.issues.length === 0) return null;

                return (
                  <div key={pIndex} className="property-issues-group">
                    <h4>{property.property_name}</h4>
                    <ul className="issues-list">
                      {property.issues.map((issue, iIndex) => (
                        <li key={iIndex} className="issue-item">
                          <span className="issue-type">{issue.type}</span>
                          {issue.expected && (
                            <span className="issue-detail">
                              Expected: <code>{issue.expected}</code>
                            </span>
                          )}
                          {issue.actual && (
                            <span className="issue-detail">
                              Actual: <code>{issue.actual}</code>
                            </span>
                          )}
                          {issue.message && (
                            <span className="issue-message">{issue.message}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SavedResultDetail;
