import React, { useState, useEffect } from 'react';
import { Activity, Globe, Clock } from 'lucide-react';
import { formatDuration } from '../utils/formatters';
import './CurrentProperty.css';

/**
 * CurrentProperty Component
 *
 * Displays currently processing property information with elapsed time
 *
 * Props:
 * - current: object - { propertyName, url, startedAt }
 */
const CurrentProperty = ({ current }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    console.log('[CurrentProperty] current:', current);
    console.log('[CurrentProperty] startedAt:', current?.startedAt, 'type:', typeof current?.startedAt);

    if (!current?.startedAt) {
      console.log('[CurrentProperty] No startedAt, resetting elapsed to 0');
      setElapsed(0);
      return;
    }

    // Calculate initial elapsed time
    // startedAt is already a timestamp (number), not a Date string
    const startTime = typeof current.startedAt === 'number'
      ? current.startedAt
      : new Date(current.startedAt).getTime();

    console.log('[CurrentProperty] startTime:', startTime, 'now:', Date.now(), 'diff:', Date.now() - startTime);

    const updateElapsed = () => {
      const now = Date.now();
      const seconds = Math.floor((now - startTime) / 1000);
      console.log('[CurrentProperty] updateElapsed - seconds:', seconds);
      setElapsed(seconds);
    };

    // Update immediately
    updateElapsed();

    // Then update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => {
      console.log('[CurrentProperty] Cleaning up interval');
      clearInterval(interval);
    };
  }, [current?.propertyName, current?.startedAt]); // Re-run when property changes

  if (!current) {
    return (
      <div className="current-property empty">
        <Activity size={24} className="empty-icon" />
        <p className="empty-text">현재 처리 중인 프로퍼티가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="current-property">
      <div className="current-header">
        <Activity size={20} className="header-icon" />
        <h3>현재 처리 중</h3>
      </div>

      <div className="property-info">
        <div className="info-row">
          <Globe size={18} className="info-icon" />
          <div className="info-content">
            <span className="info-label">프로퍼티</span>
            <span className="info-value">{current.propertyName}</span>
          </div>
        </div>

        <div className="info-row">
          <Globe size={18} className="info-icon" />
          <div className="info-content">
            <span className="info-label">URL</span>
            <span className="info-value property-url">{current.url}</span>
          </div>
        </div>

        <div className="info-row">
          <Clock size={18} className="info-icon" />
          <div className="info-content">
            <span className="info-label">경과 시간</span>
            <span className="info-value">{formatDuration(elapsed)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentProperty;
