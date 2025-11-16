/**
 * Drawer Component
 *
 * Side sliding panel with backdrop and animations.
 */

import React, { useEffect, useCallback } from 'react';
import './Drawer.css';

const Drawer = ({
  isOpen = false,
  onClose,
  title,
  children,
  side = 'right',
  width = '400px'
}) => {
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={handleBackdropClick}>
      <div
        className={`drawer-content drawer-${side}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <h2 className="drawer-title">{title}</h2>
          {onClose && (
            <button className="drawer-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Drawer;
