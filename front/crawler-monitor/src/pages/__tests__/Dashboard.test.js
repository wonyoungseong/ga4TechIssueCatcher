import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../Dashboard';
import { apiHelpers } from '../../utils/api';
import * as useWebSocketModule from '../../hooks/useWebSocket';
import * as toast from '../../utils/toast';

// Mock dependencies
jest.mock('../../utils/api');
jest.mock('../../hooks/useWebSocket');
jest.mock('../../utils/toast');

// Mock react-router-dom v7.x to avoid ESM module resolution issues
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

describe('Dashboard', () => {
  const mockStats = {
    total: 85,
    normal: 80,
    issue: 3,
    debugging: 2,
  };

  const mockRecentRuns = [
    {
      id: 'run-1',
      run_date: '2025-10-31',
      status: 'completed',
      total_properties: 85,
      completed_properties: 82,
      failed_properties: 3,
      properties_with_issues: 5,
      duration_seconds: 5400,
    },
    {
      id: 'run-2',
      run_date: '2025-10-30',
      status: 'failed',
      total_properties: 85,
      completed_properties: 70,
      failed_properties: 15,
      properties_with_issues: 8,
      duration_seconds: 3600,
    },
  ];

  const defaultMockCrawlStatus = {
    crawlStatus: null,
    connected: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    apiHelpers.getPropertiesStats.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    apiHelpers.getCrawlRuns.mockResolvedValue({
      success: true,
      data: { runs: mockRecentRuns },
    });

    apiHelpers.startCrawl.mockResolvedValue({
      success: true,
      data: { runId: 'new-run', status: 'running' },
    });

    apiHelpers.stopCrawl.mockResolvedValue({
      success: true,
    });

    useWebSocketModule.useCrawlStatus.mockReturnValue(defaultMockCrawlStatus);
    toast.showToast.mockImplementation(() => {});
  });

  describe('Initial Loading', () => {
    it('should fetch and display stats on mount', async () => {
      render(<Dashboard />);

      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText('85')).toBeInTheDocument();
      });

      expect(apiHelpers.getPropertiesStats).toHaveBeenCalledTimes(1);
    });

    it('should fetch and display recent runs on mount', async () => {
      render(<Dashboard />);

      // Wait for runs to load
      await waitFor(() => {
        expect(screen.queryByText('최근 활동을 불러오는 중...')).not.toBeInTheDocument();
      });

      expect(apiHelpers.getCrawlRuns).toHaveBeenCalledWith({ limit: 5 });
    });

    it('should display WebSocket connection status', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/연결됨/)).toBeInTheDocument();
      });
    });

    it('should display disconnected status when WebSocket is not connected', async () => {
      useWebSocketModule.useCrawlStatus.mockReturnValue({
        crawlStatus: null,
        connected: false,
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/연결 끊김/)).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display all stat cards with correct values', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('총 프로퍼티')).toBeInTheDocument();
        expect(screen.getByText('정상')).toBeInTheDocument();
        expect(screen.getByText('이슈')).toBeInTheDocument();
        expect(screen.getByText('디버깅 중')).toBeInTheDocument();
      });
    });

    it('should display percentage calculations correctly', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('94.1%')).toBeInTheDocument(); // 80/85 normal
        expect(screen.getByText('3.5%')).toBeInTheDocument(); // 3/85 issue
        expect(screen.getByText('2.4%')).toBeInTheDocument(); // 2/85 debugging
      });
    });

    it('should handle stats loading error', async () => {
      apiHelpers.getPropertiesStats.mockRejectedValue(new Error('Network error'));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('통계를 불러올 수 없습니다')).toBeInTheDocument();
      });
    });

    it('should allow retry on stats error', async () => {
      apiHelpers.getPropertiesStats.mockRejectedValueOnce(new Error('Network error'));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('통계를 불러올 수 없습니다')).toBeInTheDocument();
      });

      // Mock successful retry
      apiHelpers.getPropertiesStats.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const retryButton = screen.getByText('다시 시도');
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('85')).toBeInTheDocument();
      });
    });
  });

  describe('Crawl Control', () => {
    it('should start crawl when button clicked', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('크롤링 시작')).toBeInTheDocument();
      });

      const startButton = screen.getByText('크롤링 시작');
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(apiHelpers.startCrawl).toHaveBeenCalledWith({ browserPoolSize: 7 });
      });
    });

    it('should allow changing browser pool size', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('크롤링 시작')).toBeInTheDocument();
      });

      const poolSizeInput = screen.getByLabelText('브라우저 풀 크기:');
      await userEvent.clear(poolSizeInput);
      await userEvent.type(poolSizeInput, '10');

      const startButton = screen.getByText('크롤링 시작');
      await userEvent.click(startButton);

      await waitFor(() => {
        expect(apiHelpers.startCrawl).toHaveBeenCalledWith({ browserPoolSize: 10 });
      });
    });

    it('should display stop button when crawl is running', async () => {
      useWebSocketModule.useCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: true,
          currentRun: { id: 'active-run' },
          progress: { total: 85, completed: 42 },
        },
        connected: true,
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('크롤링 중지')).toBeInTheDocument();
      });
    });

    it('should stop crawl when stop button clicked', async () => {
      useWebSocketModule.useCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: true,
          currentRun: { id: 'active-run' },
          progress: { total: 85, completed: 42 },
        },
        connected: true,
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('크롤링 중지')).toBeInTheDocument();
      });

      const stopButton = screen.getByText('크롤링 중지');
      await userEvent.click(stopButton);

      await waitFor(() => {
        expect(apiHelpers.stopCrawl).toHaveBeenCalledWith('active-run');
      });
    });
  });

  describe('Progress Display', () => {
    it('should display progress bar when crawl is running', async () => {
      useWebSocketModule.useCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: true,
          currentRun: { id: 'active-run' },
          progress: { total: 85, completed: 42 },
        },
        connected: true,
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('진행 중: 42 / 85')).toBeInTheDocument();
        expect(screen.getByText('49%')).toBeInTheDocument();
      });
    });

    it('should not display progress bar when not running', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByText(/진행 중:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should auto-refresh stats when crawl completes', async () => {
      const { rerender } = render(<Dashboard />);

      await waitFor(() => {
        expect(apiHelpers.getPropertiesStats).toHaveBeenCalledTimes(1);
      });

      // Simulate crawl completion
      useWebSocketModule.useCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: false,
          status: 'completed',
          currentRun: null,
          progress: null,
        },
        connected: true,
      });

      rerender(<Dashboard />);

      await waitFor(() => {
        expect(apiHelpers.getPropertiesStats).toHaveBeenCalledTimes(2);
        expect(apiHelpers.getCrawlRuns).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Recent Activity', () => {
    it('should display recent runs with correct information', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/2025-10-31/)).toBeInTheDocument();
        expect(screen.getByText(/2025-10-30/)).toBeInTheDocument();
      });
    });

    it('should make activity items clickable', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/2025-10-31/)).toBeInTheDocument();
      });

      const activityItem = screen.getByText(/2025-10-31/).closest('.activity-item');
      expect(activityItem).toHaveStyle('cursor: pointer');
    });

    it('should display empty state when no runs available', async () => {
      apiHelpers.getCrawlRuns.mockResolvedValue({
        success: true,
        data: { runs: [] },
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('최근 크롤링 기록이 없습니다')).toBeInTheDocument();
      });
    });
  });
});
