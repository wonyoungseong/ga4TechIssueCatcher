/**
 * SaveResultModal Component - Story 9.4 Task 6.1
 *
 * Modal for saving crawl run results with an optional memo.
 * Allows users to add notes and save validation results for future reference.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Save } from 'lucide-react';
import Modal from './Modal';
import './SaveResultModal.css';

function SaveResultModal({ isOpen, onClose, onSave, runInfo, isSaving }) {
  const [memo, setMemo] = useState('');

  /**
   * Handle save button click
   */
  const handleSave = () => {
    onSave(memo);
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    setMemo('');
    onClose();
  };

  /**
   * Handle Enter key press in textarea
   */
  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="크롤링 결과 저장"
      size="medium"
      actions={
        <>
          <button
            className="btn-secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving || !memo.trim()}
          >
            <Save size={16} />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <div className="save-result-modal-content">
        {/* Run Information */}
        {runInfo && (
          <div className="run-info-summary">
            <div className="info-row">
              <span className="info-label">실행 날짜:</span>
              <span className="info-value">{runInfo.run_date}</span>
            </div>
            <div className="info-row">
              <span className="info-label">총 프로퍼티:</span>
              <span className="info-value">{runInfo.total_properties}개</span>
            </div>
            <div className="info-row">
              <span className="info-label">이슈 발견:</span>
              <span className="info-value highlight">
                {runInfo.properties_with_issues}개
              </span>
            </div>
          </div>
        )}

        {/* Memo Input */}
        <div className="memo-input-section">
          <label htmlFor="memo-input" className="memo-label">
            메모 <span className="required">*</span>
          </label>
          <textarea
            id="memo-input"
            className="memo-textarea"
            placeholder="이 크롤링 결과에 대한 메모를 입력하세요&#10;예: 2025년 10월 정기 검증, 신규 프로퍼티 추가 후 검증 등"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            maxLength={500}
            disabled={isSaving}
            autoFocus
          />
          <div className="memo-info">
            <span className="char-count">
              {memo.length}/500
            </span>
            <span className="keyboard-hint">
              Ctrl+Enter로 빠르게 저장
            </span>
          </div>
        </div>

        {/* Help Text */}
        <div className="help-text">
          <p>
            저장된 결과는 <strong>Saved Results</strong> 페이지에서 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </Modal>
  );
}

SaveResultModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  runInfo: PropTypes.shape({
    id: PropTypes.string,
    run_date: PropTypes.string,
    total_properties: PropTypes.number,
    properties_with_issues: PropTypes.number,
  }),
  isSaving: PropTypes.bool,
};

SaveResultModal.defaultProps = {
  runInfo: null,
  isSaving: false,
};

export default SaveResultModal;
