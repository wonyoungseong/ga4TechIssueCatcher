/**
 * Toast Notification System
 *
 * Provides a simple interface for displaying toast notifications using react-hot-toast.
 * Supports 4 types: success, error, warning, info
 */

import toast from 'react-hot-toast';

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success' | 'error' | 'warning' | 'info'
 * @param {object} options - Additional options for react-hot-toast
 * @returns {string} Toast ID
 */
export const showToast = (message, type = 'info', options = {}) => {
  const config = {
    duration: 4000,
    position: 'top-right',
    ...options,
  };

  switch (type) {
    case 'success':
      return toast.success(message, config);
    case 'error':
      return toast.error(message, config);
    case 'warning':
      return toast(message, { icon: '⚠️', ...config });
    case 'info':
    default:
      return toast(message, config);
  }
};

/**
 * Success toast shorthand
 */
export const showSuccess = (message, options = {}) => {
  return showToast(message, 'success', options);
};

/**
 * Error toast shorthand
 */
export const showError = (message, options = {}) => {
  return showToast(message, 'error', options);
};

/**
 * Warning toast shorthand
 */
export const showWarning = (message, options = {}) => {
  return showToast(message, 'warning', options);
};

/**
 * Info toast shorthand
 */
export const showInfo = (message, options = {}) => {
  return showToast(message, 'info', options);
};

export default {
  showToast,
  showSuccess,
  showError,
  showWarning,
  showInfo,
};
