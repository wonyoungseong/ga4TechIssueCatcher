/**
 * Data Conversion and Manipulation Utilities
 *
 * Provides utilities for data format conversion, file operations, and data manipulation.
 */

/**
 * Convert array of objects to CSV format
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<string>} headers - Optional custom headers (uses object keys if not provided)
 * @returns {string} CSV string
 */
export const convertToCSV = (data, headers = null) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Extract headers from first object if not provided
  const keys = headers || Object.keys(data[0]);

  // Create CSV header row
  const headerRow = keys.join(',');

  // Create CSV data rows
  const dataRows = data.map((row) => {
    return keys.map((key) => {
      const value = row[key];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Escape commas, quotes, and newlines
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
};

/**
 * Download file to user's computer
 * @param {string} content - File content
 * @param {string} filename - Filename with extension
 * @param {string} mimeType - MIME type (default: 'text/plain')
 */
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download data as CSV file
 * @param {Array<Object>} data - Array of objects
 * @param {string} filename - Filename (without .csv extension)
 * @param {Array<string>} headers - Optional custom headers
 */
export const downloadCSV = (data, filename, headers = null) => {
  const csv = convertToCSV(data, headers);
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Download data as JSON file
 * @param {any} data - Data to download
 * @param {string} filename - Filename (without .json extension)
 */
export const downloadJSON = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
};

/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted file size string (e.g., "1.2 MB")
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 B';
  if (typeof bytes !== 'number' || bytes < 0) return 'N/A';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`;
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    return false;
  }
};

/**
 * Parse CSV string to array of objects
 * @param {string} csv - CSV string
 * @param {string} delimiter - Column delimiter (default: ',')
 * @returns {Array<Object>} Array of objects
 */
export const parseCSV = (csv, delimiter = ',') => {
  if (!csv) return [];

  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(delimiter).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(delimiter);
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index]?.trim() || '';
    });
    return obj;
  });
};

/**
 * Group array of objects by key
 * @param {Array<Object>} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

export default {
  convertToCSV,
  downloadFile,
  downloadCSV,
  downloadJSON,
  formatFileSize,
  copyToClipboard,
  parseCSV,
  groupBy,
};
