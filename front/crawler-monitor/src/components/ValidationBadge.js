/**
 * ValidationBadge Component
 *
 * Displays expected vs actual value comparison with visual indicator.
 */

import React from 'react';
import './ValidationBadge.css';

const ValidationBadge = ({
  expected,
  actual,
  type = 'inline',
  label = null
}) => {
  const isMatch = expected === actual;
  const icon = isMatch ? '✓' : '✗';
  const statusClass = isMatch ? 'match' : 'mismatch';

  if (type === 'compact') {
    return (
      <span className={`validation-badge compact ${statusClass}`}>
        <span className="badge-icon">{icon}</span>
        {label && <span className="badge-label">{label}</span>}
      </span>
    );
  }

  return (
    <div className={`validation-badge ${statusClass}`}>
      <div className="badge-header">
        <span className="badge-icon">{icon}</span>
        {label && <span className="badge-label">{label}</span>}
      </div>
      <div className="badge-content">
        <div className="badge-row">
          <span className="badge-key">기대값:</span>
          <span className="badge-value expected">{expected || 'N/A'}</span>
        </div>
        <div className="badge-row">
          <span className="badge-key">실제값:</span>
          <span className="badge-value actual">{actual || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
};

export default ValidationBadge;
