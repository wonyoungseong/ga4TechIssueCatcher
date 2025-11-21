import React from 'react';
import './EnvironmentBanner.css';

const EnvironmentBanner = ({ message, type = 'info' }) => {
  const icon = type === 'warning' ? '⚠️' : 'ℹ️';
  const ariaLabel = type === 'warning' ? '경고' : '정보';

  return (
    <div
      className={`environment-banner ${type}`}
      role="alert"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span className="banner-icon" aria-hidden="true">{icon}</span>
      <span className="banner-message">{message}</span>
    </div>
  );
};

export default EnvironmentBanner;
