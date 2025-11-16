import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  Settings,
  Activity,
  Clock,
  Play,
  Square,
  Save
} from 'lucide-react';
import { apiHelpers } from '../utils/api';
import { useCrawlStatus } from '../hooks/useWebSocket';
import { showToast } from '../utils/toast';
import { formatDate, formatDuration } from '../utils/formatters';
import { getStatusLabel, getStatusColor } from '../utils/statusUtils';
import { LoadingSpinner } from '../components/LoadingSpinner';
import BrowserPoolStatus from '../components/BrowserPoolStatus';
import { API_BASE_URL } from '../utils/constants';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();

  // State management
  const [stats, setStats] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [browserPoolSize, setBrowserPoolSize] = useState(7);
  const [tempBrowserPoolSize, setTempBrowserPoolSize] = useState('7'); // 입력 중인 값 (문자열)
  const [localCrawlStatus, setLocalCrawlStatus] = useState(null);

  // WebSocket real-time updates
  const { crawlStatus: wsCrawlStatus, connected } = useCrawlStatus(true);

  // Load saved browser pool size from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('browserPoolSize');
    if (saved) {
      const value = parseInt(saved);
      if (!isNaN(value) && value >= 1 && value <= 7) {
        setBrowserPoolSize(value);
        setTempBrowserPoolSize(saved);
      }
    }
  }, []);

  // Fetch statistics on mount
  useEffect(() => {
    fetchStats();
    fetchRecentRuns();
    fetchCrawlStatus();

    // Poll crawl status every 2 seconds
    const interval = setInterval(fetchCrawlStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch crawl status from HTTP API
  const fetchCrawlStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/crawl/status`);
      const result = await response.json();
      if (result.success) {
        setLocalCrawlStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch crawl status:', error);
    }
  };

  // Use WebSocket status if available, otherwise HTTP status
  const crawlStatus = wsCrawlStatus || localCrawlStatus;

  // Auto-refresh stats when crawl completes
  useEffect(() => {
    if (crawlStatus?.status === 'completed' || crawlStatus?.status === 'failed') {
      fetchStats();
      fetchRecentRuns();
    }
  }, [crawlStatus?.status]);

  /**
   * Fetch properties statistics
   */
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await apiHelpers.getPropertiesStats();

      if (response.success) {
        setStats(response.data);
      } else {
        showToast('통계를 불러오는데 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      showToast(error.message || '통계를 불러오는데 실패했습니다', 'error');
    } finally {
      setIsLoadingStats(false);
    }
  };

  /**
   * Fetch recent crawl runs
   */
  const fetchRecentRuns = async () => {
    try {
      setIsLoadingRuns(true);
      const response = await apiHelpers.getCrawlRuns({ limit: 5 });

      if (response.success) {
        setRecentRuns(response.data.runs || response.data || []);
      } else {
        showToast('최근 활동을 불러오는데 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('Error fetching recent runs:', error);
      showToast(error.message || '최근 활동을 불러오는데 실패했습니다', 'error');
    } finally {
      setIsLoadingRuns(false);
    }
  };

  /**
   * Start crawl
   */
  const handleStartCrawl = async () => {
    try {
      setIsStarting(true);
      const response = await apiHelpers.startCrawl({ browserPoolSize });

      if (response.success) {
        showToast('크롤링이 시작되었습니다', 'success');
        // Navigate to processing page to monitor progress
        navigate('/processing');
      } else {
        showToast('크롤링 시작에 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('Error starting crawl:', error);
      showToast(error.message || '크롤링 시작에 실패했습니다', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Stop crawl
   */
  const handleStopCrawl = async () => {
    if (!crawlStatus?.currentRun?.id) {
      showToast('실행 중인 크롤링이 없습니다', 'warning');
      return;
    }

    try {
      setIsStopping(true);
      const response = await apiHelpers.stopCrawl(crawlStatus.currentRun.id);

      if (response.success) {
        showToast('크롤링이 중지되었습니다', 'success');
      } else {
        showToast('크롤링 중지에 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('Error stopping crawl:', error);
      showToast(error.message || '크롤링 중지에 실패했습니다', 'error');
    } finally {
      setIsStopping(false);
    }
  };

  /**
   * Save browser pool size
   */
  const handleSavePoolSize = () => {
    const value = parseInt(tempBrowserPoolSize);

    if (isNaN(value) || value < 1 || value > 7) {
      showToast('브라우저 풀 크기는 1~7 사이의 숫자여야 합니다', 'error');
      setTempBrowserPoolSize(browserPoolSize.toString());
      return;
    }

    setBrowserPoolSize(value);
    localStorage.setItem('browserPoolSize', value.toString());
    showToast(`브라우저 풀 크기가 ${value}로 설정되었습니다`, 'success');
  };

  /**
   * Handle input change for browser pool size
   */
  const handlePoolSizeChange = (e) => {
    const value = e.target.value;

    // Allow empty string or valid numbers
    if (value === '' || /^[0-9]+$/.test(value)) {
      setTempBrowserPoolSize(value);
    }
  };

  /**
   * Calculate crawl progress percentage
   */
  const getProgressPercentage = () => {
    if (!crawlStatus?.progress) return 0;
    const { total, completed } = crawlStatus.progress;
    if (!total) return 0;
    return Math.round((completed / total) * 100);
  };

  /**
   * Determine if crawl is currently running
   */
  const isRunning = crawlStatus?.isRunning || false;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>크롤링 대시보드</h1>
          <p className="page-subtitle">
            GA4 & GTM 추적 스크립트 모니터링 시스템
            {connected && <span className="ws-status connected"> • 연결됨</span>}
            {!connected && <span className="ws-status disconnected"> • 연결 끊김</span>}
          </p>
        </div>
      </div>

      {/* Crawl Control Section */}
      <div className="dashboard-actions">
        {!isRunning ? (
          <>
            <div className="control-group">
              <label htmlFor="browserPoolSize">브라우저 풀 크기 (최대 7):</label>
              <input
                id="browserPoolSize"
                type="text"
                value={tempBrowserPoolSize}
                onChange={handlePoolSizeChange}
                disabled={isStarting}
                className="pool-size-input"
                placeholder="1-7"
              />
              <button
                className="btn-secondary btn-save"
                onClick={handleSavePoolSize}
                disabled={isStarting || tempBrowserPoolSize === browserPoolSize.toString()}
                title="브라우저 풀 크기 저장"
              >
                <Save size={18} />
                저장
              </button>
            </div>
            <button
              className="btn-primary"
              onClick={handleStartCrawl}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <LoadingSpinner size="small" />
                  시작 중...
                </>
              ) : (
                <>
                  <Play size={20} />
                  크롤링 시작
                </>
              )}
            </button>
          </>
        ) : (
          <button
            className="btn-danger"
            onClick={handleStopCrawl}
            disabled={isStopping}
          >
            {isStopping ? (
              <>
                <LoadingSpinner size="small" />
                중지 중...
              </>
            ) : (
              <>
                <Square size={20} />
                크롤링 중지
              </>
            )}
          </button>
        )}
      </div>

      {/* Progress Bar (when running) */}
      {isRunning && crawlStatus?.progress && (
        <div className="progress-section">
          <div className="progress-info">
            <span>진행 중: {crawlStatus.progress.completed} / {crawlStatus.progress.total}</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {isLoadingStats ? (
        <div className="stats-loading">
          <LoadingSpinner />
          <p>통계를 불러오는 중...</p>
        </div>
      ) : stats ? (
        <div className="stats-grid">
          <div className="stat-card stat-blue">
            <div className="stat-content">
              <p className="stat-label">총 프로퍼티</p>
              <h2 className="stat-value">{stats.total?.toLocaleString() || 0}</h2>
            </div>
            <Database size={48} className="stat-icon" />
          </div>

          <div className="stat-card stat-green">
            <div className="stat-content">
              <p className="stat-label">정상</p>
              <h2 className="stat-value">{stats.normal?.toLocaleString() || 0}</h2>
            </div>
            <CheckCircle size={48} className="stat-icon" />
            <div className="stat-percentage">
              {stats.total > 0 ? `${((stats.normal / stats.total) * 100).toFixed(1)}%` : '0%'}
            </div>
          </div>

          <div className="stat-card stat-orange">
            <div className="stat-content">
              <p className="stat-label">이슈</p>
              <h2 className="stat-value">{stats.issue?.toLocaleString() || 0}</h2>
            </div>
            <AlertTriangle size={48} className="stat-icon" />
            <div className="stat-percentage">
              {stats.total > 0 ? `${((stats.issue / stats.total) * 100).toFixed(1)}%` : '0%'}
            </div>
          </div>

          <div className="stat-card stat-purple">
            <div className="stat-content">
              <p className="stat-label">디버깅 중</p>
              <h2 className="stat-value">{stats.debugging?.toLocaleString() || 0}</h2>
            </div>
            <Settings size={48} className="stat-icon" />
            <div className="stat-percentage">
              {stats.total > 0 ? `${((stats.debugging / stats.total) * 100).toFixed(1)}%` : '0%'}
            </div>
          </div>
        </div>
      ) : (
        <div className="stats-error">
          <p>통계를 불러올 수 없습니다</p>
          <button className="btn-secondary" onClick={fetchStats}>다시 시도</button>
        </div>
      )}

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>최근 크롤링 활동</h3>
        <p className="section-subtitle">최근 5개의 크롤링 기록</p>

        {isLoadingRuns ? (
          <div className="activity-loading">
            <LoadingSpinner />
            <p>최근 활동을 불러오는 중...</p>
          </div>
        ) : recentRuns.length > 0 ? (
          <div className="activity-list">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="activity-item"
                onClick={() => navigate(`/reports?runId=${run.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="activity-icon">
                  <Activity
                    size={24}
                    className={`icon-${getStatusColor(run.status)}`}
                  />
                </div>
                <div className="activity-info">
                  <p className="activity-status">
                    <span className={`status-badge ${getStatusColor(run.status)}`}>
                      {getStatusLabel(run.status)}
                    </span>
                  </p>
                  <p className="activity-time">
                    <Clock size={14} />
                    {formatDate(run.run_date || run.started_at)}
                  </p>
                </div>
                <div className="activity-stats">
                  <span className="stat-text">
                    총: <strong>{run.total_properties || 0}</strong>
                  </span>
                  <span className="stat-text success">
                    완료: <strong>{run.completed_properties || 0}</strong>
                  </span>
                  <span className="stat-text error">
                    실패: <strong>{run.failed_properties || 0}</strong>
                  </span>
                  {run.properties_with_issues > 0 && (
                    <span className="stat-text issue">
                      이슈: <strong>{run.properties_with_issues}</strong>
                    </span>
                  )}
                  {run.duration_seconds && (
                    <span className="stat-text">
                      소요시간: <strong>{formatDuration(run.duration_seconds)}</strong>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-empty">
            <p>최근 크롤링 기록이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
