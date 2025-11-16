/**
 * Switch Component
 *
 * Toggle switch with accessibility support.
 */

import React from 'react';
import './Switch.css';

const Switch = ({
  checked = false,
  onChange,
  disabled = false,
  label = null,
  id = null
}) => {
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

  const handleKeyPress = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && onChange) {
        onChange(!checked);
      }
    }
  };

  return (
    <div className="switch-container">
      <label className="switch" htmlFor={switchId}>
        <input
          type="checkbox"
          id={switchId}
          checked={checked}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
          className="switch-input"
        />
        <span
          className={`switch-slider ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
          tabIndex={disabled ? -1 : 0}
          role="switch"
          aria-checked={checked}
          aria-disabled={disabled}
          onKeyPress={handleKeyPress}
        />
      </label>
      {label && <span className="switch-label">{label}</span>}
    </div>
  );
};

export default Switch;
