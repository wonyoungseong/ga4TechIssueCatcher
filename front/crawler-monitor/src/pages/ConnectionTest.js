/**
 * Connection Test Page
 *
 * Tests API and WebSocket connections to the backend server.
 */

import React, { useState, useEffect } from 'react';
import { apiHelpers } from '../utils/api';
import { useWebSocket, useCrawlStatus } from '../hooks/useWebSocket';
import { useApi } from '../hooks/useApi';

function ConnectionTest() {
  const [apiStatus, setApiStatus] = useState(null);
  const [propertiesStats, setPropertiesStats] = useState(null);

  const { loading: statusLoading, error: statusError, execute: executeStatus } = useApi();
  const { loading: statsLoading, error: statsError, execute: executeStats } = useApi();

  const { connected, state, lastMessage } = useWebSocket(true);
  const { crawlStatus } = useCrawlStatus(true);

  const [messages, setMessages] = useState([]);

  // Add new messages to the list
  useEffect(() => {
    if (lastMessage) {
      setMessages(prev => [...prev, lastMessage].slice(-10)); // Keep last 10 messages
    }
  }, [lastMessage]);

  // Test API Status
  const testApiStatus = async () => {
    try {
      const data = await executeStatus(() => apiHelpers.getStatus());
      setApiStatus(data);
    } catch (error) {
      console.error('API Status test failed:', error);
    }
  };

  // Test Properties Stats
  const testPropertiesStats = async () => {
    try {
      const data = await executeStats(() => apiHelpers.getPropertiesStats());
      setPropertiesStats(data);
    } catch (error) {
      console.error('Properties Stats test failed:', error);
    }
  };

  // Auto-test on mount
  useEffect(() => {
    testApiStatus();
    testPropertiesStats();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔌 Connection Test</h1>

      {/* WebSocket Status */}
      <section style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>WebSocket Connection</h2>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          <div>
            <strong>State:</strong>
            <span style={{
              marginLeft: '10px',
              padding: '4px 8px',
              borderRadius: '4px',
              background: connected ? '#4caf50' : '#ff9800',
              color: 'white'
            }}>
              {state}
            </span>
          </div>
          <div>
            <strong>Connected:</strong> {connected ? '✅ Yes' : '❌ No'}
          </div>
        </div>

        <div>
          <h3>Latest Messages ({messages.length})</h3>
          <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
            {messages.length === 0 ? 'No messages yet...' : JSON.stringify(messages, null, 2)}
          </pre>
        </div>

        {crawlStatus && (
          <div>
            <h3>Crawl Status</h3>
            <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
              {JSON.stringify(crawlStatus, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* API Status Test */}
      <section style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>API Status Test</h2>
        <button
          onClick={testApiStatus}
          disabled={statusLoading}
          style={{
            padding: '10px 20px',
            marginBottom: '10px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {statusLoading ? 'Loading...' : 'Test GET /api/status'}
        </button>

        {statusError && (
          <div style={{ color: 'red', marginBottom: '10px' }}>
            ❌ Error: {statusError.message}
          </div>
        )}

        {apiStatus && (
          <div>
            <h3>✅ Response:</h3>
            <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(apiStatus, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Properties Stats Test */}
      <section style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Properties Stats Test</h2>
        <button
          onClick={testPropertiesStats}
          disabled={statsLoading}
          style={{
            padding: '10px 20px',
            marginBottom: '10px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {statsLoading ? 'Loading...' : 'Test GET /api/properties/summary/stats'}
        </button>

        {statsError && (
          <div style={{ color: 'red', marginBottom: '10px' }}>
            ❌ Error: {statsError.message}
          </div>
        )}

        {propertiesStats && (
          <div>
            <h3>✅ Response:</h3>
            <pre style={{ background: '#fff', padding: '10px', borderRadius: '4px' }}>
              {JSON.stringify(propertiesStats, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Summary */}
      <section style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
        <h2>Connection Summary</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>WebSocket: {connected ? '✅ Connected' : '❌ Disconnected'}</li>
          <li>API Status: {apiStatus ? '✅ Working' : statusError ? '❌ Failed' : '⏳ Not tested'}</li>
          <li>Properties API: {propertiesStats ? '✅ Working' : statsError ? '❌ Failed' : '⏳ Not tested'}</li>
        </ul>
      </section>
    </div>
  );
}

export default ConnectionTest;
