/**
 * useWebSocket Hook
 *
 * Provides real-time WebSocket connection with automatic lifecycle management.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { wsClient, WebSocketState } from '../utils/websocket';

export function useWebSocket(autoConnect = true) {
  const [state, setState] = useState(wsClient.getState());
  const [lastMessage, setLastMessage] = useState(null);
  const unsubscribeRef = useRef(null);
  const stateUnsubscribeRef = useRef(null);

  useEffect(() => {
    // Subscribe to state changes
    stateUnsubscribeRef.current = wsClient.subscribeToState((newState) => {
      setState(newState);
    });

    // Subscribe to messages
    unsubscribeRef.current = wsClient.subscribe((message) => {
      setLastMessage(message);
    });

    // Auto-connect if requested
    if (autoConnect && !wsClient.isConnected()) {
      wsClient.connect().catch((error) => {
        console.error('[useWebSocket] Connection failed:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (stateUnsubscribeRef.current) {
        stateUnsubscribeRef.current();
      }
    };
  }, [autoConnect]);

  const send = useCallback((data) => {
    wsClient.send(data);
  }, []);

  const connect = useCallback(async () => {
    return wsClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return {
    state,
    connected: state === WebSocketState.CONNECTED,
    lastMessage,
    send,
    connect,
    disconnect,
  };
}

/**
 * Hook for subscribing to specific message types
 *
 * IMPORTANT: To prevent memory leaks and unnecessary re-subscriptions, wrap your callback
 * with useCallback or ensure it has a stable reference:
 *
 * @example
 * // ✅ GOOD - Callback is memoized
 * const handleMessage = useCallback((data) => {
 *   console.log('Received:', data);
 * }, []);
 * useWebSocketSubscription('update', handleMessage);
 *
 * @example
 * // ❌ BAD - Callback creates new reference on every render
 * useWebSocketSubscription('update', (data) => {
 *   console.log('Received:', data);
 * });
 *
 * @param {string} messageType - The message type to filter
 * @param {Function} callback - Message handler (should be memoized with useCallback)
 * @param {boolean} autoConnect - Auto-connect to WebSocket (default: true)
 * @returns {Object} WebSocket state and controls
 */
export function useWebSocketSubscription(messageType, callback, autoConnect = true) {
  const { state, connected, send } = useWebSocket(autoConnect);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === messageType) {
        callback(message.data || message);
      }
    });

    return unsubscribe;
  }, [messageType, callback]);

  return { state, connected, send };
}

/**
 * Hook specifically for crawl status updates
 */
export function useCrawlStatus(autoSubscribe = true) {
  const [crawlStatus, setCrawlStatus] = useState(null);
  const { connected, send } = useWebSocket(true);

  useEffect(() => {
    if (!connected || !autoSubscribe) {
      return;
    }

    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'crawl_status') {
        setCrawlStatus(message.data);
      }
    });

    // Request current status
    send({ type: 'subscribe_crawl_status' });

    return unsubscribe;
  }, [connected, autoSubscribe, send]);

  return { crawlStatus, connected };
}

export default useWebSocket;
