import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrawlStatus } from '../hooks/useWebSocket';
import { wsClient } from '../utils/websocket';
import { showToast } from '../utils/toast';
import { API_BASE_URL } from '../utils/constants';
import ConnectionStatus from '../components/ConnectionStatus';
import ProgressOverview from '../components/ProgressOverview';
import CurrentProperty from '../components/CurrentProperty';
import BrowserPoolStatus from '../components/BrowserPoolStatus';
import LogStream from '../components/LogStream';
import CompletionSummary from '../components/CompletionSummary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import './Processing.css';

/**
 * Processing Page
 *
 * Real-time monitoring page for crawling progress with WebSocket integration
 * Displays progress, browser pool status, current property, and live logs
 */
const Processing = () => {
  // Navigation hook
  const navigate = useNavigate();

  // WebSocket connection and crawl status
  const { crawlStatus: wsCrawlStatus, connected } = useCrawlStatus(true);

  // Local crawl status state (from HTTP API)
  const [crawlStatus, setCrawlStatus] = useState(null);

  // Log messages state
  const [logs, setLogs] = useState([]);

  // Track reconnection attempts
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Stop crawl state
  const [isStopping, setIsStopping] = useState(false);

  // Browser pool size from localStorage
  const [savedBrowserPoolSize, setSavedBrowserPoolSize] = useState(7);

  // Track previous completion status to detect transitions
  const [previousStatus, setPreviousStatus] = useState(null);

  // Load saved browser pool size from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('browserPoolSize');
    if (saved) {
      const value = parseInt(saved);
      if (!isNaN(value) && value >= 1 && value <= 7) {
        setSavedBrowserPoolSize(value);
      }
    }
  }, []);

  // Fetch initial status from HTTP API
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/crawl/status`);
        const result = await response.json();
        if (result.success) {
          setCrawlStatus(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch crawl status:', error);
      }
    };

    fetchStatus();
    // Poll every 2 seconds
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update from WebSocket when available
  useEffect(() => {
    if (wsCrawlStatus) {
      setCrawlStatus(wsCrawlStatus);
    }
  }, [wsCrawlStatus]);

  // Subscribe to log messages from WebSocket
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'log') {
        setLogs(prev => {
          const newLogs = [...prev, message.data];
          // Keep only last 100 logs for performance
          return newLogs.slice(-100);
        });
      }

      // Track reconnection attempts
      if (message.type === 'reconnecting') {
        setReconnectAttempts(message.data?.attempt || 0);
      } else if (message.type === 'reconnected') {
        setReconnectAttempts(0);
        showToast('WebSocket 연결 복구됨', 'success');
      }
    });

    return unsubscribe;
  }, []);

  // Show completion toast and redirect to Reports when crawling finishes
  useEffect(() => {
    const currentStatus = crawlStatus?.currentRun?.status;
    const currentRunId = crawlStatus?.currentRun?.id;

    console.log('[Processing] Status check:', {
      currentStatus,
      previousStatus,
      currentRunId,
      willRedirect: currentStatus === 'completed' && previousStatus !== 'completed'
    });

    // Check if status changed from running to completed
    if (currentStatus === 'completed' && previousStatus !== 'completed') {
      console.log('[Processing] Crawling completed! Redirecting to Reports...');
      showToast('크롤링이 완료되었습니다. 리포트 페이지로 이동합니다...', 'success');

      // Navigate to Reports page after 2 seconds
      setTimeout(() => {
        const targetPath = currentRunId ? `/reports/${currentRunId}` : '/reports';
        console.log('[Processing] Navigating to:', targetPath);
        navigate(targetPath);
      }, 2000);
    } else if (currentStatus === 'failed' && previousStatus !== 'failed') {
      showToast('크롤링이 실패했습니다', 'error');
    }

    // Update previous status
    setPreviousStatus(currentStatus);
  }, [crawlStatus?.currentRun?.status, crawlStatus?.currentRun?.id, previousStatus, navigate]);

  // Clear logs handler
  const handleClearLogs = () => {
    setLogs([]);
    showToast('로그가 지워졌습니다', 'info');
  };

  // Stop crawl handler
  const handleStopCrawl = async () => {
    if (!isRunning || isStopping) return;

    setIsStopping(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/crawl/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('크롤링이 중단되었습니다', 'success');
      } else {
        throw new Error(result.error || '크롤링 중단에 실패했습니다');
      }
    } catch (error) {
      console.error('Stop crawl error:', error);
      showToast(error.message || '크롤링 중단 중 오류가 발생했습니다', 'error');
    } finally {
      setIsStopping(false);
    }
  };

  // Loading state
  if (!crawlStatus) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>크롤링 진행 중</h1>
          <p className="page-subtitle">실시간 크롤링 상태 및 로그</p>
        </div>
        <div className="loading-container">
          <LoadingSpinner />
          <p>크롤링 상태를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isCompleted = crawlStatus.currentRun?.status === 'completed';
  const isRunning = crawlStatus.isRunning;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <h1>크롤링 진행 중</h1>
          <p className="page-subtitle">실시간 크롤링 상태 및 로그</p>
        </div>
        <div className="header-actions">
          {isRunning && (
            <button
              className="btn btn-danger"
              onClick={handleStopCrawl}
              disabled={isStopping}
            >
              {isStopping ? '중단 중...' : '크롤링 중단'}
            </button>
          )}
          <ConnectionStatus
            connected={connected}
            reconnectAttempts={reconnectAttempts}
          />
        </div>
      </div>

      <div className="processing-content">
        {/* Completion Summary - Show when completed */}
        {isCompleted && (
          <CompletionSummary
            currentRun={crawlStatus.currentRun}
            progress={crawlStatus.progress}
          />
        )}

        {/* Progress Overview - Show when running */}
        {isRunning && (
          <ProgressOverview progress={crawlStatus.progress} />
        )}

        {/* Main Grid */}
        <div className="processing-grid">
          {/* Left Column */}
          <div className="processing-left">
            {/* Current Property */}
            {isRunning && (
              <CurrentProperty current={crawlStatus.progress?.current} />
            )}

            {/* Browser Pool Status */}
            <BrowserPoolStatus
              browserPoolSize={crawlStatus.browserPoolSize || savedBrowserPoolSize}
              activeBrowsers={crawlStatus.activeBrowsers || 0}
            />
          </div>

          {/* Right Column - Log Stream */}
          <div className="processing-right">
            <LogStream
              logs={logs}
              onClear={handleClearLogs}
            />
          </div>
        </div>

        {/* Show message when not running and not completed */}
        {!isRunning && !isCompleted && (
          <div className="not-running-message">
            <p>현재 진행 중인 크롤링이 없습니다</p>
            <p className="message-subtitle">Dashboard에서 크롤링을 시작하세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Processing;
