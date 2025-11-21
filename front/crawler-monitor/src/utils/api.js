/**
 * REST API Client
 *
 * Provides a simple interface for making HTTP requests to the backend API.
 * Includes automatic JSON parsing, error handling, and timeout management.
 */

import { API_BASE_URL, API_TIMEOUT } from './constants';
import { ApiError, logError } from './errors';

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.timeout = API_TIMEOUT;
  }

  /**
   * Make HTTP request with automatic error handling, timeout, and retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries remaining (default: 3)
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}, retries = 3) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      let data = isJson ? await response.json() : await response.text();

      // Limit text error responses to prevent memory issues
      if (!isJson && typeof data === 'string' && data.length > 1000) {
        data = data.substring(0, 1000) + '... (truncated)';
      }

      // Handle HTTP errors
      if (!response.ok) {
        const errorMessage = isJson && data.error ? data.error : data;
        const apiError = new ApiError(response.status, errorMessage, data);

        // Retry on server errors (5xx) if retries remaining
        if (response.status >= 500 && retries > 0) {
          const delay = 1000 * (4 - retries); // Exponential backoff: 1s, 2s, 3s
          console.warn(`[API] Server error ${response.status}, retrying in ${delay}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(endpoint, options, retries - 1);
        }

        throw apiError;
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new ApiError(408, 'Request timeout');
        logError(timeoutError, { endpoint, options });
        throw timeoutError;
      }

      // Network errors (status 0) - retry if retries remaining
      if (!navigator.onLine || error.message === 'Failed to fetch') {
        const networkError = new ApiError(0, 'No internet connection');

        if (retries > 0) {
          const delay = 1000 * (4 - retries); // Exponential backoff: 1s, 2s, 3s
          console.warn(`[API] Network error, retrying in ${delay}ms (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(endpoint, options, retries - 1);
        }

        logError(networkError, { endpoint, options });
        throw networkError;
      }

      logError(error, { endpoint, options });
      throw error;
    }
  }

  /**
   * GET request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request with JSON body
   */
  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request with JSON body
   */
  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

// Create singleton instance
export const api = new ApiClient();

// API helper functions
export const apiHelpers = {
  /**
   * Get server status
   */
  getStatus: () => api.get('/api/status'),

  /**
   * Get environment information
   */
  getEnvironment: () => api.get('/api/environment'),

  /**
   * Get properties summary stats
   */
  getPropertiesStats: () => api.get('/api/properties/summary/stats'),

  /**
   * Get all properties with optional filters
   */
  getProperties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/api/properties${query ? `?${query}` : ''}`);
  },

  /**
   * Get single property
   */
  getProperty: (id) => api.get(`/api/properties/${id}`),

  /**
   * Update property status
   */
  updatePropertyStatus: (id, status, notes, changedBy = 'user') =>
    api.put(`/api/properties/${id}/status`, { status, notes, changed_by: changedBy }),

  /**
   * Get property status history
   */
  getPropertyStatusHistory: (id) => api.get(`/api/properties/${id}/status-history`),

  /**
   * Get property history (alias for story 9.6 compatibility)
   */
  getPropertyHistory: (id) => api.get(`/api/properties/${id}/history`),

  /**
   * Create a new property
   */
  createProperty: (data) => api.post('/api/properties', data),

  /**
   * Update property (e.g., is_active toggle)
   */
  updateProperty: (id, data) => api.put(`/api/properties/${id}`, data),

  /**
   * Delete property
   */
  deleteProperty: (id) => api.delete(`/api/properties/${id}`),

  /**
   * Start crawl
   */
  startCrawl: (config = {}) => api.post('/api/crawl/start', config),

  /**
   * Stop crawl
   */
  stopCrawl: (runId) => api.post('/api/crawl/stop', { runId }),

  /**
   * Get crawl status
   */
  getCrawlStatus: () => api.get('/api/crawl/status'),

  /**
   * Get crawl runs history
   */
  getCrawlRuns: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/api/crawl/runs${query ? `?${query}` : ''}`);
  },

  /**
   * Get results for a specific crawl run
   */
  getCrawlRunResults: (runId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/api/crawl/runs/${runId}/results${query ? `?${query}` : ''}`);
  },

  /**
   * Save a crawl run with memo
   */
  saveCrawlRun: (runId, data) => api.post(`/api/crawl/runs/${runId}/save`, data),

  /**
   * Get validation results
   */
  getResults: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/api/results${query ? `?${query}` : ''}`);
  },

  /**
   * Get results for specific date
   */
  getResultsByDate: (date) => api.get(`/api/results/${date}`),

  /**
   * Get available dates
   */
  getDates: () => api.get('/api/dates'),

  /**
   * Get summary for specific date
   */
  getSummary: (date) => api.get(`/api/summary/${date}`),

  /**
   * Get saved results with pagination
   */
  getSavedResults: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/api/crawl/saved-results${query ? `?${query}` : ''}`);
  },

  /**
   * Get saved result detail by ID
   */
  getSavedResultDetail: (id) => api.get(`/api/crawl/saved-results/${id}`),

  /**
   * Update saved result (e.g., memo)
   */
  updateSavedResult: (id, data) => api.put(`/api/crawl/saved-results/${id}`, data),

  /**
   * Delete saved result by ID
   */
  deleteSavedResult: (id) => api.delete(`/api/crawl/saved-results/${id}`),
};

export default api;
