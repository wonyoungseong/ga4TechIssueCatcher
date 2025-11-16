import React, { useState } from 'react';
import { Calendar, FileText, Eye, Download, Trash2, Edit3 } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import './SavedResultCard.css';

/**
 * SavedResultCard Component
 *
 * Displays a saved crawl result as a card with:
 * - Save date and original run date
 * - Editable memo
 * - Statistics (total properties, issues)
 * - Action buttons (view detail, export, delete)
 * - Compare mode checkbox
 *
 * Props:
 * - result: object - Saved result data
 * - onViewDetail: function - Callback for viewing details
 * - onExport: function - Callback for exporting
 * - onDelete: function - Callback for deletion
 * - onMemoUpdate: function - Callback for memo updates
 * - compareMode: boolean - Whether compare mode is active
 * - isSelected: boolean - Whether this card is selected for comparison
 * - onToggleCompare: function - Callback for compare selection
 * - compareDisabled: boolean - Whether compare checkbox should be disabled
 */
const SavedResultCard = ({
  result,
  onViewDetail,
  onExport,
  onDelete,
  onMemoUpdate,
  compareMode = false,
  isSelected = false,
  onToggleCompare,
  compareDisabled = false
}) => {
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const [memoValue, setMemoValue] = useState(result.memo || '');

  const handleMemoClick = () => {
    setIsEditingMemo(true);
  };

  const handleMemoBlur = async () => {
    setIsEditingMemo(false);
    if (memoValue !== result.memo) {
      await onMemoUpdate(result.id, memoValue);
    }
  };

  const handleMemoChange = (e) => {
    setMemoValue(e.target.value);
  };

  const handleMemoKeyDown = (e) => {
    if (e.key === 'Escape') {
      setMemoValue(result.memo || '');
      setIsEditingMemo(false);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.target.blur();
    }
  };

  return (
    <div className={`saved-result-card ${isSelected ? 'selected' : ''}`}>
      <div className="card-header">
        <div className="card-dates">
          <div className="date-item">
            <Calendar size={14} className="date-icon" />
            <div className="date-content">
              <span className="date-label">저장일</span>
              <span className="date-value">
                {formatDate(result.saved_at, 'YYYY-MM-DD HH:mm')}
              </span>
            </div>
          </div>
          <div className="date-item">
            <FileText size={14} className="date-icon" />
            <div className="date-content">
              <span className="date-label">크롤링 실행일</span>
              <span className="date-value">
                {formatDate(result.original_run_date, 'YYYY-MM-DD')}
              </span>
            </div>
          </div>
        </div>

        {compareMode && (
          <div className="compare-checkbox">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleCompare(result.id)}
              disabled={compareDisabled}
              title={compareDisabled ? '최대 2개만 선택 가능' : '비교 선택'}
            />
          </div>
        )}
      </div>

      <div className="card-memo">
        {isEditingMemo ? (
          <textarea
            className="memo-textarea"
            value={memoValue}
            onChange={handleMemoChange}
            onBlur={handleMemoBlur}
            onKeyDown={handleMemoKeyDown}
            placeholder="메모를 입력하세요..."
            autoFocus
            rows={3}
          />
        ) : (
          <div className="memo-display" onClick={handleMemoClick}>
            <Edit3 size={14} className="memo-edit-icon" />
            <p className="memo-text">
              {result.memo || '메모를 추가하려면 클릭하세요...'}
            </p>
          </div>
        )}
      </div>

      <div className="card-stats">
        <div className="stat-item">
          <span className="stat-label">총 프로퍼티</span>
          <span className="stat-value">{result.total_properties}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">이슈 발견</span>
          <span className={`stat-value ${result.properties_with_issues > 0 ? 'warning' : ''}`}>
            {result.properties_with_issues}
          </span>
        </div>
      </div>

      <div className="card-actions">
        <button
          className="action-btn primary"
          onClick={() => onViewDetail(result.id)}
          title="상세 보기"
        >
          <Eye size={16} />
          상세 보기
        </button>
        <button
          className="action-btn secondary"
          onClick={() => onExport(result.id)}
          title="CSV 다운로드"
        >
          <Download size={16} />
          내보내기
        </button>
        <button
          className="action-btn danger"
          onClick={() => onDelete(result.id)}
          title="삭제"
        >
          <Trash2 size={16} />
          삭제
        </button>
      </div>
    </div>
  );
};

export default SavedResultCard;
