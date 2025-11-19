/**
 * Application Constants
 */

// Use relative URLs in production, localhost in development
const getBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // In production, use current origin (same host as React app)
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  // In development, use localhost
  return 'http://localhost:3000';
};

const getWsUrl = () => {
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  // In production, use current host with ws/wss protocol
  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  // In development, use localhost
  return 'ws://localhost:3000/ws';
};

export const API_BASE_URL = getBaseUrl();
export const WS_URL = getWsUrl();

export const API_TIMEOUT = 10000; // 10 seconds

export const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_INITIAL_RECONNECT_DELAY = 1000; // 1 second
export const WS_MAX_RECONNECT_DELAY = 30000; // 30 seconds

export const PropertyStatus = {
  NORMAL: 'normal',
  ISSUE: 'issue',
  DEBUGGING: 'debugging',
};

export const CrawlRunStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};
