/**
 * Application Constants
 */

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws';

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
