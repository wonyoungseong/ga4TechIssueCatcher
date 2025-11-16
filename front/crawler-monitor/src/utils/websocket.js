/**
 * WebSocket Client
 *
 * Provides real-time communication with the backend server.
 * Includes automatic reconnection, heartbeat, and message queuing.
 */

import {
  WS_URL,
  WS_HEARTBEAT_INTERVAL,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_INITIAL_RECONNECT_DELAY,
  WS_MAX_RECONNECT_DELAY,
} from './constants';

export const WebSocketState = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

class WebSocketClient {
  constructor(url = WS_URL) {
    this.url = url;
    this.ws = null;
    this.state = WebSocketState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = WS_INITIAL_RECONNECT_DELAY;
    this.messageQueue = [];
    this.listeners = new Map();
    this.heartbeatInterval = null;
    this.reconnectTimeout = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      // Already connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // If already connecting, return existing connection promise
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.log('[WS] Connection already in progress, waiting for completion');
        // Wait for the existing connection to complete
        const checkConnection = setInterval(() => {
          if (this.ws.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          } else if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
        return;
      }

      this.state = WebSocketState.CONNECTING;
      this.notifyStateChange();

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected to', this.url);
          this.state = WebSocketState.CONNECTED;
          this.reconnectAttempts = 0;
          this.reconnectDelay = WS_INITIAL_RECONNECT_DELAY;
          this.notifyStateChange();
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('[WS] Received:', message);
            this.notifyListeners(message);
          } catch (error) {
            console.error('[WS] Invalid message format:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          this.state = WebSocketState.ERROR;
          this.notifyStateChange();
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected', event.code, event.reason);
          this.state = WebSocketState.DISCONNECTED;
          this.notifyStateChange();
          this.stopHeartbeat();

          // Don't reconnect if close was intentional (code 1000)
          if (event.code !== 1000) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error('[WS] Connection failed:', error);
        this.state = WebSocketState.ERROR;
        this.notifyStateChange();
        reject(error);
      }
    });
  }

  /**
   * Send message to server
   */
  send(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      console.log('[WS] Sent:', data);
    } else {
      console.log('[WS] Queuing message (not connected):', data);
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to messages
   * Returns unsubscribe function
   */
  subscribe(callback) {
    const id = Math.random().toString(36).substr(2, 9);
    this.listeners.set(id, callback);
    console.log('[WS] Added listener:', id);

    return () => {
      this.listeners.delete(id);
      console.log('[WS] Removed listener:', id);
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribeToState(callback) {
    const id = `state_${Math.random().toString(36).substr(2, 9)}`;
    this.listeners.set(id, (message) => {
      if (message.type === '__state_change__') {
        callback(message.state);
      }
    });

    return () => this.listeners.delete(id);
  }

  /**
   * Notify all listeners of new message
   */
  notifyListeners(message) {
    this.listeners.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error('[WS] Listener error:', error);
      }
    });
  }

  /**
   * Notify state change
   */
  notifyStateChange() {
    this.notifyListeners({
      type: '__state_change__',
      state: this.state,
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      WS_MAX_RECONNECT_DELAY
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        console.error('[WS] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing interval

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, WS_HEARTBEAT_INTERVAL);

    console.log('[WS] Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[WS] Heartbeat stopped');
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    console.log(`[WS] Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      }
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    console.log('[WS] Disconnecting...');

    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Use code 1000 for normal closure to prevent auto-reconnect
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.state = WebSocketState.DISCONNECTED;
    this.notifyStateChange();
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.state === WebSocketState.CONNECTED;
  }
}

// Create singleton instance
export const wsClient = new WebSocketClient();

// WebSocket helper functions
export const wsHelpers = {
  /**
   * Subscribe to crawl status updates
   */
  subscribeCrawlStatus: (callback) => {
    // Subscribe to messages
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'crawl_status') {
        callback(message.data);
      }
    });

    // Request current status
    wsClient.send({ type: 'subscribe_crawl_status' });

    return unsubscribe;
  },

  /**
   * Connect and subscribe in one call
   */
  connectAndSubscribe: async (callback) => {
    await wsClient.connect();
    return wsHelpers.subscribeCrawlStatus(callback);
  },
};

export default wsClient;
