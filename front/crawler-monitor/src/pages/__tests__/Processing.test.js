import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Processing from '../Processing';

// Mock dependencies
const mockUseCrawlStatus = jest.fn();
const mockWsClientSubscribe = jest.fn(() => jest.fn());
const mockShowToast = jest.fn();
const mockConvertToCSV = jest.fn(() => 'csv,data');
const mockDownloadFile = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../hooks/useWebSocket', () => ({
  useCrawlStatus: () => mockUseCrawlStatus()
}));

jest.mock('../../utils/websocket', () => ({
  wsClient: {
    subscribe: (...args) => mockWsClientSubscribe(...args)
  }
}));

jest.mock('../../utils/toast', () => ({
  showToast: (...args) => mockShowToast(...args)
}));

jest.mock('../../utils/dataUtils', () => ({
  convertToCSV: (...args) => mockConvertToCSV(...args),
  downloadFile: (...args) => mockDownloadFile(...args)
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('Processing Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: Running crawl
    mockUseCrawlStatus.mockReturnValue({
      crawlStatus: {
        isRunning: true,
        runId: 'test-run-id',
        currentRun: {
          id: 'test-run-id',
          status: 'running',
          total_properties: 85,
          completed_properties: 42,
          failed_properties: 2,
          started_at: '2025-10-31T03:00:00Z'
        },
        progress: {
          total: 85,
          completed: 42,
          failed: 2,
          current: {
            propertyName: '[EC] INNISFREE - US',
            url: 'https://us.innisfree.com',
            startedAt: '2025-10-31T03:15:30Z'
          }
        },
        browserPoolSize: 7,
        activeBrowsers: 5
      },
      connected: true
    });
  });

  describe('Connection Status', () => {
    it('should display connected status when WebSocket is connected', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('실시간 연결됨')).toBeInTheDocument();
    });

    it('should display disconnected status when WebSocket is disconnected', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: { isRunning: false },
        connected: false
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText(/연결 중.../)).toBeInTheDocument();
    });

    it('should display reconnection attempts', () => {
      const { rerender } = render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // Simulate reconnection attempt
      const subscribeCallback = mockWsClientSubscribe.mock.calls[0][0];
      subscribeCallback({ type: 'reconnecting', data: { attempt: 3 } });

      rerender(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText(/3회 재시도/)).toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('should display progress statistics', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('85')).toBeInTheDocument(); // total
      expect(screen.getByText('42')).toBeInTheDocument(); // completed
      expect(screen.getByText('2')).toBeInTheDocument(); // failed
    });

    it('should calculate and display progress percentage', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // 42/85 = 49.4% -> rounds to 49%
      expect(screen.getByText('49%')).toBeInTheDocument();
    });

    it('should display current property information', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      expect(screen.getByText('https://us.innisfree.com')).toBeInTheDocument();
    });
  });

  describe('Browser Pool Status', () => {
    it('should display browser pool statistics', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('7')).toBeInTheDocument(); // total browsers
      expect(screen.getByText('5')).toBeInTheDocument(); // active browsers
    });

    it('should calculate browser usage percentage', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // 5/7 = 71.4% -> rounds to 71%
      expect(screen.getByText('71%')).toBeInTheDocument();
    });

    it('should display browser grid with correct states', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // Should show 7 browser items (5 active, 2 idle)
      const browserItems = screen.getAllByText(/#\d+/);
      expect(browserItems).toHaveLength(7);
    });
  });

  describe('Log Stream', () => {
    it('should receive and display log messages', async () => {
      const { rerender } = render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // Simulate log message via WebSocket
      const subscribeCallback = mockWsClientSubscribe.mock.calls[0][0];
      subscribeCallback({
        type: 'log',
        data: {
          level: 'INFO',
          message: 'Processing property...',
          timestamp: new Date().toISOString()
        }
      });

      rerender(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Processing property/)).toBeInTheDocument();
      });
    });

    it('should maintain max 100 logs', async () => {
      const { rerender } = render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      const subscribeCallback = mockWsClientSubscribe.mock.calls[0][0];

      // Add 105 logs
      for (let i = 0; i < 105; i++) {
        subscribeCallback({
          type: 'log',
          data: {
            level: 'INFO',
            message: `Log message ${i}`,
            timestamp: new Date().toISOString()
          }
        });
      }

      rerender(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should only show last 100 logs
        expect(screen.queryByText('Log message 0')).not.toBeInTheDocument();
        expect(screen.queryByText('Log message 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Log message 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Log message 3')).not.toBeInTheDocument();
        expect(screen.queryByText('Log message 4')).not.toBeInTheDocument();
        expect(screen.getByText(/Log message 104/)).toBeInTheDocument();
      });
    });

    it('should download logs when button clicked', async () => {
      mockConvertToCSV = jest.fn(() => 'csv,data');
      mockDownloadFile = jest.fn();

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // Add a log first
      const subscribeCallback = mockWsClientSubscribe.mock.calls[0][0];
      subscribeCallback({
        type: 'log',
        data: {
          level: 'INFO',
          message: 'Test log',
          timestamp: new Date().toISOString()
        }
      });

      const downloadButton = screen.getByText('다운로드');
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockConvertToCSV).toHaveBeenCalled();
        expect(mockDownloadFile).toHaveBeenCalled();
      });
    });

    it('should clear logs when clear button clicked', async () => {
      const { rerender } = render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      // Add logs
      const subscribeCallback = mockWsClientSubscribe.mock.calls[0][0];
      subscribeCallback({
        type: 'log',
        data: {
          level: 'INFO',
          message: 'Test log',
          timestamp: new Date().toISOString()
        }
      });

      rerender(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test log')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('지우기');
      fireEvent.click(clearButton);

      rerender(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Test log')).not.toBeInTheDocument();
      });
    });
  });

  describe('Completion Summary', () => {
    it('should display completion summary when crawl is completed', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: false,
          currentRun: {
            id: 'test-run-id',
            status: 'completed',
            total_properties: 85,
            completed_properties: 83,
            failed_properties: 2,
            started_at: '2025-10-31T03:00:00Z'
          },
          progress: {
            total: 85,
            completed: 83,
            failed: 2
          }
        },
        connected: true
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('크롤링 완료')).toBeInTheDocument();
      expect(screen.getByText('결과 보기')).toBeInTheDocument();
    });

    it('should navigate to results page when button clicked', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: false,
          currentRun: {
            id: 'test-run-id',
            status: 'completed',
            total_properties: 85,
            completed_properties: 83,
            failed_properties: 2,
            started_at: '2025-10-31T03:00:00Z'
          },
          progress: {
            total: 85,
            completed: 83,
            failed: 2
          }
        },
        connected: true
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      const resultButton = screen.getByText('결과 보기');
      fireEvent.click(resultButton);

      expect(mockNavigate).toHaveBeenCalledWith('/reports/test-run-id');
    });
  });

  describe('Empty States', () => {
    it('should display loading state when crawlStatus is null', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: null,
        connected: false
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('크롤링 상태를 불러오는 중...')).toBeInTheDocument();
    });

    it('should display "not running" message when crawl is not active', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: false,
          currentRun: null
        },
        connected: true
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('현재 진행 중인 크롤링이 없습니다')).toBeInTheDocument();
      expect(screen.getByText('Dashboard에서 크롤링을 시작하세요')).toBeInTheDocument();
    });

    it('should display empty state for current property when none is processing', () => {
      mockUseCrawlStatus.mockReturnValue({
        crawlStatus: {
          isRunning: true,
          progress: {
            total: 85,
            completed: 0,
            failed: 0,
            current: null
          },
          browserPoolSize: 7,
          activeBrowsers: 0
        },
        connected: true
      });

      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(screen.getByText('현재 처리 중인 프로퍼티가 없습니다')).toBeInTheDocument();
    });
  });

  describe('WebSocket Integration', () => {
    it('should subscribe to WebSocket messages on mount', () => {
      render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      expect(mockWsClientSubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe from WebSocket on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockWsClientSubscribe.mockReturnValue(unsubscribeMock);

      const { unmount } = render(
        <MemoryRouter>
          <Processing />
        </MemoryRouter>
      );

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
