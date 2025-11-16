import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Filter,
  Search,
  ArrowUpDown,
  ChevronDown,
  History,
  CheckSquare,
  ArrowRight,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Wrench,
  RefreshCw
} from 'lucide-react';
import { apiHelpers } from '../utils/api';
import { showToast } from '../utils/toast';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusUtils';
import { Modal, Drawer, Switch, LoadingSpinner, EmptyState } from '../components';
import './StatusManagement.css';

const StatusManagement = () => {
  // State management
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    isActive: 'all',
    consentMode: 'all'
  });
  const [sortConfig, setSortConfig] = useState({
    field: 'property_name',
    direction: 'asc'
  });

  // Bulk change state
  const [bulkChangeMode, setBulkChangeMode] = useState(false);
  const [bulkChangeStatus, setBulkChangeStatus] = useState('');
  const [bulkChangeReason, setBulkChangeReason] = useState('');
  const [bulkChangeProgress, setBulkChangeProgress] = useState(null);

  // History drawer state
  const [showHistory, setShowHistory] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /**
   * Fetch properties from API with current filters and sorting
   */
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.isActive !== 'all' && { is_active: filters.isActive === 'active' }),
        ...(filters.search && { search: filters.search }),
        sort_by: sortConfig.field,
        sort_order: sortConfig.direction,
        limit: 10000 // Fetch all properties without limit
      };

      const response = await apiHelpers.getProperties(params);

      if (response.success) {
        setProperties(response.data.properties || []);
      } else {
        throw new Error('Failed to fetch properties');
      }
    } catch (err) {
      setError(err.message);
      showToast('프로퍼티 목록을 불러올 수 없습니다', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.isActive, filters.search, sortConfig.field, sortConfig.direction]);

  // Fetch properties on mount and filter/sort changes
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  /**
   * Handle single property status change with optimistic update
   */
  const handleStatusChange = async (propertyId, newStatus, reason) => {
    if (!reason || !reason.trim()) {
      showToast('변경 사유를 입력해주세요', 'error');
      return;
    }

    // Find current property
    const currentProperty = properties.find(p => p.id === propertyId);
    if (!currentProperty) return;

    // Optimistic update
    setProperties(prev =>
      prev.map(p =>
        p.id === propertyId
          ? { ...p, current_status: newStatus, updated_at: new Date().toISOString() }
          : p
      )
    );

    try {
      const response = await apiHelpers.updatePropertyStatus(
        propertyId,
        newStatus,
        reason.trim(),
        'user'
      );

      if (response.success) {
        showToast('상태가 변경되었습니다', 'success');
        // Refresh to get latest data from server
        fetchProperties();
      } else {
        throw new Error('Status update failed');
      }
    } catch (err) {
      // Rollback on error
      setProperties(prev =>
        prev.map(p =>
          p.id === propertyId ? currentProperty : p
        )
      );
      showToast(err.message || '상태 변경에 실패했습니다', 'error');
    }
  };

  /**
   * Handle bulk status change
   */
  const handleBulkStatusChange = async () => {
    if (!bulkChangeStatus) {
      showToast('변경할 상태를 선택해주세요', 'error');
      return;
    }

    if (!bulkChangeReason.trim()) {
      showToast('변경 사유를 입력해주세요', 'error');
      return;
    }

    const totalCount = selectedProperties.length;
    let successCount = 0;
    let failCount = 0;

    setBulkChangeProgress({ total: totalCount, current: 0 });

    for (const propertyId of selectedProperties) {
      try {
        await apiHelpers.updatePropertyStatus(
          propertyId,
          bulkChangeStatus,
          bulkChangeReason.trim(),
          'user'
        );
        successCount++;
      } catch (err) {
        failCount++;
      }

      setBulkChangeProgress(prev => ({
        ...prev,
        current: prev.current + 1
      }));
    }

    // Show results
    if (failCount === 0) {
      showToast(`${successCount}개 프로퍼티 상태가 변경되었습니다`, 'success');
    } else {
      showToast(
        `${successCount}개 성공, ${failCount}개 실패`,
        'warning'
      );
    }

    // Reset and refresh
    fetchProperties();
    setSelectedProperties([]);
    setBulkChangeMode(false);
    setBulkChangeStatus('');
    setBulkChangeReason('');
    setBulkChangeProgress(null);
  };

  /**
   * Fetch property history
   */
  const fetchHistory = async (propertyId) => {
    setHistoryLoading(true);
    setShowHistory(propertyId);

    try {
      const response = await apiHelpers.getPropertyHistory(propertyId);

      if (response.success) {
        setHistory(response.data.history || []);
      } else {
        throw new Error('Failed to fetch history');
      }
    } catch (err) {
      showToast('이력을 불러올 수 없습니다', 'error');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * Handle property activation toggle
   */
  const handleToggleActive = async (propertyId, isActive) => {
    const currentProperty = properties.find(p => p.id === propertyId);
    if (!currentProperty) return;

    // Optimistic update
    setProperties(prev =>
      prev.map(p =>
        p.id === propertyId ? { ...p, is_active: isActive } : p
      )
    );

    try {
      const response = await apiHelpers.updateProperty(propertyId, {
        is_active: isActive
      });

      if (response.success) {
        showToast(
          `프로퍼티가 ${isActive ? '활성화' : '비활성화'}되었습니다`,
          'success'
        );
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      // Rollback on error
      setProperties(prev =>
        prev.map(p =>
          p.id === propertyId ? currentProperty : p
        )
      );
      showToast(err.message || '활성화 상태 변경에 실패했습니다', 'error');
    }
  };

  /**
   * Handle sorting
   */
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  /**
   * Handle select all
   */
  const handleSelectAll = () => {
    if (selectedProperties.length === filteredAndSorted.length) {
      setSelectedProperties([]);
    } else {
      setSelectedProperties(filteredAndSorted.map(p => p.id));
    }
  };

  /**
   * Handle toggle select
   */
  const handleToggleSelect = (propertyId) => {
    setSelectedProperties(prev =>
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  /**
   * Filter and sort properties
   */
  const filteredAndSorted = useMemo(() => {
    let result = [...properties];

    // Apply filters
    if (filters.status !== 'all') {
      result = result.filter(p => p.current_status === filters.status);
    }

    if (filters.isActive !== 'all') {
      result = result.filter(p =>
        filters.isActive === 'active' ? p.is_active : !p.is_active
      );
    }

    if (filters.consentMode !== 'all') {
      result = result.filter(p =>
        filters.consentMode === 'enabled' ? p.has_consent_mode : !p.has_consent_mode
      );
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(p =>
        p.property_name.toLowerCase().includes(search) ||
        p.url.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [properties, filters, sortConfig]);

  /**
   * Calculate summary stats
   */
  const summaryStats = useMemo(() => ({
    total: properties.length,
    normal: properties.filter(p => p.current_status === 'normal').length,
    issue: properties.filter(p => p.current_status === 'issue').length,
    debugging: properties.filter(p => p.current_status === 'debugging').length
  }), [properties]);

  // Loading state
  if (loading && properties.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>상태 관리</h1>
        </div>
        <LoadingSpinner message="프로퍼티 목록을 불러오는 중..." />
      </div>
    );
  }

  // Error state
  if (error && properties.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>상태 관리</h1>
        </div>
        <EmptyState
          message="프로퍼티 목록을 불러올 수 없습니다"
          action={
            <button onClick={fetchProperties} className="btn-primary">
              다시 시도
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>상태 관리</h1>
        <p className="page-subtitle">프로퍼티별 상태 설정 및 관리</p>
      </div>

      {/* Summary Stats */}
      <div className="status-summary">
        <div className="summary-item summary-total">
          <div className="summary-icon">
            <CheckSquare size={24} />
          </div>
          <div className="summary-content">
            <h3>{summaryStats.total}</h3>
            <p>전체 프로퍼티</p>
          </div>
        </div>
        <div className="summary-item summary-green">
          <div className="summary-icon">
            <CheckCircle size={24} />
          </div>
          <div className="summary-content">
            <h3>{summaryStats.normal}</h3>
            <p>정상</p>
          </div>
        </div>
        <div className="summary-item summary-red">
          <div className="summary-icon">
            <AlertCircle size={24} />
          </div>
          <div className="summary-content">
            <h3>{summaryStats.issue}</h3>
            <p>이슈</p>
          </div>
        </div>
        <div className="summary-item summary-orange">
          <div className="summary-icon">
            <Wrench size={24} />
          </div>
          <div className="summary-content">
            <h3>{summaryStats.debugging}</h3>
            <p>디버깅 중</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filters">
          <div className="filter-group">
            <Filter size={16} />
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="filter-select"
            >
              <option value="all">전체 상태</option>
              <option value="normal">정상</option>
              <option value="issue">이슈</option>
              <option value="debugging">디버깅 중</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.isActive}
              onChange={(e) => setFilters(prev => ({ ...prev, isActive: e.target.value }))}
              className="filter-select"
            >
              <option value="all">전체</option>
              <option value="active">활성화</option>
              <option value="inactive">비활성화</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.consentMode}
              onChange={(e) => setFilters(prev => ({ ...prev, consentMode: e.target.value }))}
              className="filter-select"
            >
              <option value="all">Consent Mode 전체</option>
              <option value="enabled">사용</option>
              <option value="disabled">미사용</option>
            </select>
          </div>

          <div className="search-group">
            <Search size={16} />
            <input
              type="text"
              placeholder="프로퍼티 검색..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="search-input"
            />
          </div>
        </div>

        <div className="actions">
          {selectedProperties.length > 0 && (
            <button
              onClick={() => setBulkChangeMode(true)}
              className="btn-bulk-action"
            >
              일괄 변경 ({selectedProperties.length})
            </button>
          )}

          <button onClick={fetchProperties} className="btn-refresh" title="새로고침">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Properties Table */}
      {filteredAndSorted.length === 0 ? (
        <EmptyState message="검색 결과가 없습니다" />
      ) : (
        <div className="table-container">
          <table className="properties-table">
            <thead>
              <tr>
                <th className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedProperties.length === filteredAndSorted.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th
                  className="col-sortable"
                  onClick={() => handleSort('property_name')}
                >
                  프로퍼티명
                  {sortConfig.field === 'property_name' && (
                    <ArrowUpDown size={14} className={sortConfig.direction === 'desc' ? 'rotated' : ''} />
                  )}
                </th>
                <th>URL</th>
                <th
                  className="col-sortable"
                  onClick={() => handleSort('current_status')}
                >
                  상태
                  {sortConfig.field === 'current_status' && (
                    <ArrowUpDown size={14} className={sortConfig.direction === 'desc' ? 'rotated' : ''} />
                  )}
                </th>
                <th
                  className="col-sortable"
                  onClick={() => handleSort('updated_at')}
                >
                  최종 업데이트
                  {sortConfig.field === 'updated_at' && (
                    <ArrowUpDown size={14} className={sortConfig.direction === 'desc' ? 'rotated' : ''} />
                  )}
                </th>
                <th>활성화</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((property) => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  selected={selectedProperties.includes(property.id)}
                  onToggleSelect={handleToggleSelect}
                  onStatusChange={handleStatusChange}
                  onToggleActive={handleToggleActive}
                  onViewHistory={fetchHistory}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Change Modal */}
      {bulkChangeMode && (
        <Modal
          isOpen={true}
          onClose={() => !bulkChangeProgress && setBulkChangeMode(false)}
          title="일괄 상태 변경"
        >
          <div className="bulk-change-modal">
            <div className="selection-summary">
              <p>{selectedProperties.length}개 프로퍼티가 선택되었습니다</p>
            </div>

            <div className="form-group">
              <label>변경할 상태</label>
              <select
                value={bulkChangeStatus}
                onChange={(e) => setBulkChangeStatus(e.target.value)}
                disabled={bulkChangeProgress !== null}
              >
                <option value="">선택하세요</option>
                <option value="normal">정상</option>
                <option value="issue">이슈</option>
                <option value="debugging">디버깅 중</option>
              </select>
            </div>

            <div className="form-group">
              <label>변경 사유 (필수)</label>
              <textarea
                value={bulkChangeReason}
                onChange={(e) => setBulkChangeReason(e.target.value)}
                placeholder="일괄 변경 사유를 입력하세요"
                rows={4}
                disabled={bulkChangeProgress !== null}
              />
            </div>

            {bulkChangeProgress && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(bulkChangeProgress.current / bulkChangeProgress.total) * 100}%`
                    }}
                  />
                </div>
                <p>
                  {bulkChangeProgress.current} / {bulkChangeProgress.total}
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button
                onClick={() => setBulkChangeMode(false)}
                disabled={bulkChangeProgress !== null}
                className="btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleBulkStatusChange}
                disabled={
                  !bulkChangeStatus ||
                  !bulkChangeReason.trim() ||
                  bulkChangeProgress !== null
                }
                className="btn-primary"
              >
                {bulkChangeProgress ? '진행 중...' : '변경 실행'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* History Drawer */}
      {showHistory && (
        <Drawer
          isOpen={true}
          onClose={() => setShowHistory(null)}
          title="상태 변경 이력"
        >
          {historyLoading ? (
            <LoadingSpinner message="이력을 불러오는 중..." />
          ) : history.length === 0 ? (
            <EmptyState message="변경 이력이 없습니다" />
          ) : (
            <div className="history-timeline">
              {history.map((entry) => (
                <div key={entry.id} className="timeline-entry">
                  <div className="timeline-marker">
                    <div className={`status-dot ${entry.new_status}`} />
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-header">
                      <div className="status-change">
                        {entry.previous_status && (
                          <>
                            <span className={`status-badge ${entry.previous_status}`}>
                              {getStatusLabel(entry.previous_status)}
                            </span>
                            <ArrowRight size={16} />
                          </>
                        )}
                        <span className={`status-badge ${entry.new_status}`}>
                          {getStatusLabel(entry.new_status)}
                        </span>
                      </div>

                      <div className="timestamp">
                        <Clock size={14} />
                        {formatDateTime(entry.changed_at)}
                      </div>
                    </div>

                    {entry.change_reason && (
                      <div className="reason">
                        <label>사유</label>
                        <p>{entry.change_reason}</p>
                      </div>
                    )}

                    <div className="meta">
                      <User size={14} />
                      <span>{entry.changed_by}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
};

/**
 * Property Row Component
 */
const PropertyRow = ({
  property,
  selected,
  onToggleSelect,
  onStatusChange,
  onToggleActive,
  onViewHistory
}) => {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [reason, setReason] = useState('');

  const handleConfirmStatusChange = () => {
    if (!reason.trim()) {
      showToast('변경 사유를 입력해주세요', 'error');
      return;
    }

    onStatusChange(property.id, selectedStatus, reason);
    setStatusDropdownOpen(false);
    setSelectedStatus(null);
    setReason('');
  };

  return (
    <tr className={selected ? 'selected' : ''}>
      <td className="col-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(property.id)}
        />
      </td>
      <td className="property-name">{property.property_name}</td>
      <td>
        <a
          href={property.url}
          target="_blank"
          rel="noopener noreferrer"
          className="property-url"
        >
          {property.url}
        </a>
      </td>
      <td>
        <div className="status-dropdown-container">
          <button
            className={`status-badge ${property.current_status}`}
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
          >
            {getStatusLabel(property.current_status)}
            <ChevronDown size={14} />
          </button>

          {statusDropdownOpen && (
            <div className="dropdown-menu">
              <div className="status-options">
                {['normal', 'issue', 'debugging'].map((status) => (
                  <button
                    key={status}
                    className={status === property.current_status ? 'current' : ''}
                    onClick={() => setSelectedStatus(status)}
                    disabled={status === property.current_status}
                  >
                    {getStatusLabel(status)}
                  </button>
                ))}
              </div>

              {selectedStatus && selectedStatus !== property.current_status && (
                <div className="reason-input">
                  <textarea
                    placeholder="변경 사유를 입력하세요"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                  <div className="actions">
                    <button
                      onClick={() => {
                        setSelectedStatus(null);
                        setReason('');
                      }}
                      className="btn-secondary btn-sm"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleConfirmStatusChange}
                      className="btn-primary btn-sm"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
      <td>{formatRelativeTime(property.updated_at)}</td>
      <td>
        <Switch
          checked={property.is_active}
          onChange={(checked) => onToggleActive(property.id, checked)}
        />
      </td>
      <td>
        <button
          onClick={() => onViewHistory(property.id)}
          className="btn-icon"
          title="이력 보기"
        >
          <History size={16} />
        </button>
      </td>
    </tr>
  );
};

export default StatusManagement;
