import React, { useState, useEffect, useRef } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { convertToCSV, downloadFile } from '../utils/dataUtils';
import './LogStream.css';

/**
 * LogStream Component
 *
 * Displays real-time log messages with filtering, search, and download capabilities
 *
 * Props:
 * - logs: array - Array of log objects { level, message, timestamp, context }
 * - onClear: function - Optional callback to clear logs
 */
const LogStream = ({ logs = [], onClear }) => {
  const [logFilter, setLogFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs by level
  const filteredByLevel = logs.filter(log => {
    if (logFilter === 'ALL') return true;
    return log.level === logFilter;
  });

  // Filter logs by search query
  const filteredLogs = filteredByLevel.filter(log => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.message.toLowerCase().includes(searchLower) ||
      (log.context?.propertyName?.toLowerCase().includes(searchLower)) ||
      (log.context?.url?.toLowerCase().includes(searchLower))
    );
  });

  // Download logs as CSV
  const handleDownload = () => {
    const csvData = logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      propertyName: log.context?.propertyName || '',
      url: log.context?.url || ''
    }));

    const csv = convertToCSV(csvData, ['timestamp', 'level', 'message', 'propertyName', 'url']);
    const filename = `crawl-logs-${Date.now()}.csv`;
    downloadFile(csv, filename, 'text/csv');
  };

  return (
    <div className="log-stream">
      <div className="log-header">
        <h3>실시간 로그</h3>
        <div className="log-count">{filteredLogs.length} / {logs.length}</div>
      </div>

      <div className="log-controls">
        <div className="control-group">
          <Filter size={16} />
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="log-filter-select"
          >
            <option value="ALL">전체</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>

        <div className="control-group search-group">
          <Search size={16} />
          <input
            type="text"
            placeholder="로그 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="log-search-input"
          />
        </div>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          자동 스크롤
        </label>

        <button
          onClick={handleDownload}
          className="download-button"
          title="로그 다운로드"
          disabled={logs.length === 0}
        >
          <Download size={16} />
          다운로드
        </button>

        {onClear && (
          <button
            onClick={onClear}
            className="clear-button"
            disabled={logs.length === 0}
          >
            지우기
          </button>
        )}
      </div>

      <div className="log-container" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            {logs.length === 0 ? '로그가 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`log-entry log-${log.level.toLowerCase()}`}
            >
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className={`log-level level-${log.level.toLowerCase()}`}>
                [{log.level}]
              </span>
              <span className="log-message">{log.message}</span>
              {log.context?.propertyName && (
                <span className="log-context">({log.context.propertyName})</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogStream;
