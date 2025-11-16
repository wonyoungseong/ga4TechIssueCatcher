/**
 * RunCard Component - Story 9.4 Task 1.2
 *
 * Displays a single crawl run in card format with stats and status.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Database, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { formatDate, formatDuration } from '../utils/formatters';
import { getStatusLabel, getStatusColor } from '../utils/statusUtils';

function RunCard({ run, isSelected, onClick }) {
  const statusColor = getStatusColor(run.status);
  const statusLabel = getStatusLabel(run.status);

  return (
    <div
      className={`run-card ${isSelected ? 'run-card-selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {/* Header with date and status */}
      <div className="run-header">
        <h3>{formatDate(run.run_date)}</h3>
        <span className={`status-badge status-${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="run-stats">
        <StatItem
          label="총 프로퍼티"
          value={run.total_properties}
          icon={<Database size={16} />}
          color="blue"
        />
        <StatItem
          label="완료"
          value={run.completed_properties}
          icon={<CheckCircle size={16} />}
          color="green"
        />
        <StatItem
          label="실패"
          value={run.failed_properties}
          icon={<XCircle size={16} />}
          color="red"
        />
        <StatItem
          label="이슈"
          value={run.properties_with_issues}
          icon={<AlertTriangle size={16} />}
          color="orange"
        />
      </div>

      {/* Duration */}
      <div className="run-time">
        <Clock size={16} />
        <span>{formatDuration(run.duration_seconds)}</span>
      </div>
    </div>
  );
}

/**
 * StatItem sub-component for displaying individual stats
 */
function StatItem({ label, value, icon, color }) {
  return (
    <div className={`stat-item stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

StatItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  icon: PropTypes.element.isRequired,
  color: PropTypes.oneOf(['blue', 'green', 'red', 'orange']).isRequired,
};

RunCard.propTypes = {
  run: PropTypes.shape({
    id: PropTypes.string.isRequired,
    run_date: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    total_properties: PropTypes.number.isRequired,
    completed_properties: PropTypes.number.isRequired,
    failed_properties: PropTypes.number.isRequired,
    properties_with_issues: PropTypes.number.isRequired,
    duration_seconds: PropTypes.number.isRequired,
  }).isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

RunCard.defaultProps = {
  isSelected: false,
};

export default RunCard;
