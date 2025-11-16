import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { formatDuration } from '../utils/formatters';
import './CompletionSummary.css';

/**
 * CompletionSummary Component
 *
 * Displays crawl completion summary with statistics and navigation to results
 *
 * Props:
 * - currentRun: object - { id, status, total_properties, completed_properties, failed_properties, started_at }
 * - progress: object - { total, completed, failed }
 */
const CompletionSummary = ({ currentRun, progress }) => {
  const navigate = useNavigate();

  if (!currentRun || currentRun.status !== 'completed') {
    return null;
  }

  // Calculate total processing time
  const startTime = new Date(currentRun.started_at).getTime();
  const endTime = Date.now();
  const totalSeconds = Math.floor((endTime - startTime) / 1000);

  // Calculate issue count (failed properties)
  const issueCount = progress?.failed || currentRun.failed_properties || 0;

  const handleViewResults = () => {
    navigate(`/reports/${currentRun.id}`);
  };

  return (
    <div className="completion-summary">
      <div className="summary-header">
        <CheckCircle size={32} className="summary-icon" />
        <h2>크롤링 완료</h2>
      </div>

      <div className="summary-stats">
        <div className="summary-stat">
          <Clock size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">총 처리 시간</span>
            <span className="stat-value">{formatDuration(totalSeconds)}</span>
          </div>
        </div>

        <div className="summary-stat">
          <CheckCircle size={20} className="stat-icon stat-success" />
          <div className="stat-content">
            <span className="stat-label">성공</span>
            <span className="stat-value stat-success">
              {progress?.completed || currentRun.completed_properties || 0}
            </span>
          </div>
        </div>

        <div className="summary-stat">
          <AlertCircle size={20} className="stat-icon stat-error" />
          <div className="stat-content">
            <span className="stat-label">실패</span>
            <span className="stat-value stat-error">
              {issueCount}
            </span>
          </div>
        </div>

        <div className="summary-stat">
          <FileText size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">이슈 발견</span>
            <span className="stat-value">{issueCount}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleViewResults}
        className="view-results-button"
      >
        <FileText size={20} />
        결과 보기
      </button>
    </div>
  );
};

export default CompletionSummary;
