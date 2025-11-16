/**
 * Date and Time Formatting Utilities
 *
 * Provides consistent date/time formatting throughout the application using dayjs.
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ko';

// Configure dayjs with Korean locale, timezone support, and relative time plugin
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ko');

// Set default timezone to Asia/Seoul (KST)
dayjs.tz.setDefault('Asia/Seoul');

/**
 * Format date to YYYY-MM-DD in KST timezone
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  return dayjs(date).tz('Asia/Seoul').format('YYYY-MM-DD');
};

/**
 * Format time to HH:mm:ss in KST timezone
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time string
 */
export const formatTime = (date) => {
  if (!date) return '';
  return dayjs(date).tz('Asia/Seoul').format('HH:mm:ss');
};

/**
 * Format date and time to YYYY-MM-DD HH:mm:ss in KST timezone
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return dayjs(date).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
};

/**
 * Format duration in seconds to human-readable format (e.g., "1h 5m 30s")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

/**
 * Format date as relative time (e.g., "3분 전", "2시간 전")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string in Korean
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';
  return dayjs(date).fromNow();
};

/**
 * Format milliseconds to seconds with decimal places
 * @param {number} ms - Milliseconds
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted seconds string
 */
export const formatMilliseconds = (ms, decimals = 2) => {
  if (typeof ms !== 'number') return '0s';
  return `${(ms / 1000).toFixed(decimals)}s`;
};

/**
 * Format date with custom format
 * @param {Date|string|number} date - Date to format
 * @param {string} format - dayjs format string
 * @returns {string} Formatted date string
 */
export const formatCustom = (date, format) => {
  if (!date) return '';
  return dayjs(date).format(format);
};

export default {
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatMilliseconds,
  formatCustom,
};
