/**
 * LoadingSpinner Component
 *
 * Displays an animated loading spinner with customizable sizes.
 */

import React from 'react';
import './LoadingSpinner.css';

export const LoadingSpinner = ({ size = 'medium', text = null }) => {
  const sizeClass = `spinner-${size}`;

  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner ${sizeClass}`} role="status" aria-label="Loading">
        <div className="spinner"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
