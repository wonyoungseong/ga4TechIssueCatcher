import React from 'react';
import { Server, Activity, Clock } from 'lucide-react';
import './BrowserPoolStatus.css';

/**
 * BrowserPoolStatus Component
 *
 * Displays browser pool utilization and individual browser states
 *
 * Props:
 * - browserPoolSize: number - Total number of browsers in pool
 * - activeBrowsers: number - Number of currently active browsers
 */
const BrowserPoolStatus = ({ browserPoolSize = 7, activeBrowsers = 0 }) => {
  const usagePercentage = browserPoolSize > 0
    ? Math.round((activeBrowsers / browserPoolSize) * 100)
    : 0;

  return (
    <div className="browser-pool-status">
      <div className="pool-header">
        <Server size={20} className="header-icon" />
        <h3>브라우저 풀</h3>
      </div>

      <div className="pool-stats">
        <div className="pool-stat">
          <span className="stat-label">전체</span>
          <span className="stat-value">{browserPoolSize}</span>
        </div>
        <div className="pool-stat">
          <span className="stat-label">활성</span>
          <span className="stat-value stat-active">{activeBrowsers}</span>
        </div>
        <div className="pool-stat">
          <span className="stat-label">대기</span>
          <span className="stat-value stat-idle">{browserPoolSize - activeBrowsers}</span>
        </div>
        <div className="pool-stat">
          <span className="stat-label">사용률</span>
          <span className="stat-value">{usagePercentage}%</span>
        </div>
      </div>

      <div className="browser-grid">
        {Array.from({ length: browserPoolSize }).map((_, i) => {
          const isActive = i < activeBrowsers;
          return (
            <div
              key={i}
              className={`browser-item ${isActive ? 'active' : 'idle'}`}
              title={`Browser ${i + 1} - ${isActive ? '활성' : '대기'}`}
            >
              {isActive ? (
                <Activity size={16} className="browser-icon" />
              ) : (
                <Clock size={16} className="browser-icon" />
              )}
              <span className="browser-label">#{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BrowserPoolStatus;
