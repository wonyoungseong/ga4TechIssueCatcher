/**
 * EmptyState Component
 *
 * Displays an empty state message with optional icon and action button.
 */

import React from 'react';
import './EmptyState.css';

const EmptyState = ({
  icon = '📭',
  title = '데이터가 없습니다',
  description = null,
  action = null
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <div className="empty-state-action">
          {typeof action === 'object' && action.label ? (
            <button onClick={action.onClick} className="btn-primary">
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
