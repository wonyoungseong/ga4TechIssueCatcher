/**
 * RunDetailModal Component
 *
 * Modal for displaying detailed validation results for a crawl run.
 * Contains the ResultsTable and save functionality.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Save } from 'lucide-react';
import Modal from './Modal';
import ResultsTable from './ResultsTable';
import './RunDetailModal.css';

function RunDetailModal({
  isOpen,
  onClose,
  selectedRun,
  filteredResults,
  allResults,
  resultsLoading,
  resultsError,
  onRetry,
  onSaveClick
}) {
  if (!selectedRun) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="검증 결과 상세"
      size="large"
      actions={
        <button
          className="btn-primary"
          onClick={onSaveClick}
          disabled={resultsLoading}
        >
          <Save size={16} />
          결과 저장
        </button>
      }
    >
      <div className="run-detail-modal-content">
        {/* Run Information Header */}
        <div className="run-info-header">
          <h3>{selectedRun.property_name || selectedRun.id}</h3>
          <p className="run-info-subtitle">프로퍼티별 검증 결과</p>
        </div>

        {/* Results Table */}
        <ResultsTable
          results={filteredResults}
          allResults={allResults}
          runId={selectedRun.id}
          loading={resultsLoading}
          error={resultsError}
          onRetry={onRetry}
        />
      </div>
    </Modal>
  );
}

RunDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedRun: PropTypes.object,
  filteredResults: PropTypes.array.isRequired,
  allResults: PropTypes.array.isRequired,
  resultsLoading: PropTypes.bool.isRequired,
  resultsError: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  onSaveClick: PropTypes.func.isRequired,
};

RunDetailModal.defaultProps = {
  selectedRun: null,
  resultsError: null,
};

export default RunDetailModal;
