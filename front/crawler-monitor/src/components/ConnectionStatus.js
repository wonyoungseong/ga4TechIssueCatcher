import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import './ConnectionStatus.css';

/**
 * ConnectionStatus Component
 *
 * Displays WebSocket connection status with visual indicators
 *
 * Props:
 * - connected: boolean - WebSocket connection state
 * - reconnectAttempts: number - Number of reconnection attempts
 */
const ConnectionStatus = ({ connected, reconnectAttempts = 0 }) => {
  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator">
        {connected ? (
          <Wifi size={20} className="status-icon" />
        ) : (
          <WifiOff size={20} className="status-icon" />
        )}
      </div>
      <span className="status-text">
        {connected ? '실시간 연결됨' :
         reconnectAttempts > 0 ? `연결 중... (${reconnectAttempts}회 재시도)` : '연결 중...'}
      </span>
    </div>
  );
};

export default ConnectionStatus;
