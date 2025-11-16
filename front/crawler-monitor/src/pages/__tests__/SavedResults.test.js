import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SavedResults from '../SavedResults';

// Mock dependencies
const mockGetSavedResults = jest.fn();
const mockGetSavedResultDetail = jest.fn();
const mockUpdateSavedResult = jest.fn();
const mockDeleteSavedResult = jest.fn();
const mockShowToast = jest.fn();
const mockConvertToCSV = jest.fn(() => 'csv,data');
const mockDownloadFile = jest.fn();
const mockHandleApiError = jest.fn((error) => ({ message: error.message || 'Error occurred' }));

jest.mock('../../utils/api', () => ({
  apiHelpers: {
    getSavedResults: (...args) => mockGetSavedResults(...args),
    getSavedResultDetail: (...args) => mockGetSavedResultDetail(...args),
    updateSavedResult: (...args) => mockUpdateSavedResult(...args),
    deleteSavedResult: (...args) => mockDeleteSavedResult(...args)
  }
}));

jest.mock('../../utils/toast', () => ({
  showToast: (...args) => mockShowToast(...args)
}));

jest.mock('../../utils/dataUtils', () => ({
  convertToCSV: (...args) => mockConvertToCSV(...args),
  downloadFile: (...args) => mockDownloadFile(...args)
}));

jest.mock('../../utils/errors', () => ({
  handleApiError: (...args) => mockHandleApiError(...args)
}));

describe('SavedResults Page', () => {
  const mockResults = [
    {
      id: 'result-1',
      original_run_id: 'run-1',
      original_run_date: '2025-10-31',
      saved_at: '2025-11-01T10:00:00Z',
      saved_by: 'user1',
      memo: '2025년 10월 정기 검증',
      total_properties: 85,
      properties_with_issues: 5
    },
    {
      id: 'result-2',
      original_run_id: 'run-2',
      original_run_date: '2025-10-30',
      saved_at: '2025-10-31T10:00:00Z',
      saved_by: 'user1',
      memo: '2025년 10월 30일 검증',
      total_properties: 85,
      properties_with_issues: 3
    }
  ];

  const mockResultDetail = {
    ...mockResults[0],
    results: [
      {
        property_id: 'prop-1',
        property_name: '[EC] INNISFREE - US',
        url: 'https://us.innisfree.com',
        status: 'success',
        issues: [],
        screenshot_url: 'https://...'
      },
      {
        property_id: 'prop-2',
        property_name: '[EC] AMOREPACIFIC - US',
        url: 'https://us.amorepacific.com',
        status: 'success',
        issues: [
          {
            type: 'GA4_MISSING',
            expected: 'G-XXXXXXXXXX',
            actual: null
          }
        ],
        screenshot_url: 'https://...'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock: Return results list
    mockGetSavedResults.mockResolvedValue({
      success: true,
      data: {
        results: mockResults,
        total: 2,
        page: 1,
        limit: 10
      }
    });

    // Detail mock
    mockGetSavedResultDetail.mockResolvedValue({
      success: true,
      data: mockResultDetail
    });

    // Update mock
    mockUpdateSavedResult.mockResolvedValue({
      success: true
    });

    // Delete mock
    mockDeleteSavedResult.mockResolvedValue({
      success: true
    });

    // Mock window.confirm
    global.confirm = jest.fn(() => true);
  });

  describe('List View', () => {
    it('should fetch and display saved results on mount', async () => {
      render(<SavedResults />);

      await waitFor(() => {
        expect(mockGetSavedResults).toHaveBeenCalledWith({
          limit: 10,
          offset: 0
        });
      });

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
        expect(screen.getByText('2025년 10월 30일 검증')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching', () => {
      mockGetSavedResults.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
          <SavedResults />
      );

      expect(screen.getByText('저장된 결과를 불러오는 중...')).toBeInTheDocument();
    });

    it('should display empty state when no results', async () => {
      mockGetSavedResults.mockResolvedValue({
        success: true,
        data: {
          results: [],
          total: 0,
          page: 1,
          limit: 10
        }
      });

      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('저장된 결과가 없습니다')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should change page when pagination buttons clicked', async () => {
      mockGetSavedResults.mockResolvedValue({
        success: true,
        data: {
          results: mockResults,
          total: 25,
          page: 1,
          limit: 10
        }
      });

      const { rerender } = render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('다음');
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(mockGetSavedResults).toHaveBeenCalledWith({
          limit: 10,
          offset: 10
        });
      });
    });
  });

  describe('Memo Editing', () => {
    it('should update memo inline', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const memoDisplay = screen.getByText('2025년 10월 정기 검증');
      await userEvent.click(memoDisplay);

      const textarea = screen.getByDisplayValue('2025년 10월 정기 검증');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Updated memo text');
      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(mockUpdateSavedResult).toHaveBeenCalledWith('result-1', {
          memo: 'Updated memo text'
        });
        expect(mockShowToast).toHaveBeenCalledWith('메모가 저장되었습니다', 'success');
      });
    });
  });

  describe('Result Deletion', () => {
    it('should delete result after confirmation', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('삭제');
      await userEvent.click(deleteButtons[0]);

      expect(global.confirm).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockDeleteSavedResult).toHaveBeenCalledWith('result-1');
        expect(mockShowToast).toHaveBeenCalledWith('결과가 삭제되었습니다', 'success');
      });
    });

    it('should not delete if user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false);

      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('삭제');
      await userEvent.click(deleteButtons[0]);

      expect(global.confirm).toHaveBeenCalled();
      expect(mockDeleteSavedResult).not.toHaveBeenCalled();
    });
  });

  describe('Detail View', () => {
    it('should fetch and display result detail when view button clicked', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('상세 보기');
      await userEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(mockGetSavedResultDetail).toHaveBeenCalledWith('result-1');
        expect(screen.getByText('저장된 결과 상세')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getAllByText('[EC] INNISFREE - US')).toHaveLength(1);
        expect(screen.getAllByText('[EC] AMOREPACIFIC - US')).toHaveLength(2); // Appears in table and issues panel
      });
    });

    it('should close detail view when close button clicked', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('상세 보기');
      await userEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('저장된 결과 상세')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('닫기');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('저장된 결과 상세')).not.toBeInTheDocument();
      });
    });
  });

  describe('Compare Mode', () => {
    it('should enable compare mode and allow selecting 2 results', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const compareButton = screen.getByText('결과 비교');
      await userEvent.click(compareButton);

      expect(screen.getByText('2개의 결과를 선택하세요')).toBeInTheDocument();

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      expect(screen.getByText('1개 더 선택하세요')).toBeInTheDocument();

      await userEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText('비교 가능')).toBeInTheDocument();
        expect(mockGetSavedResultDetail).toHaveBeenCalledWith('result-1');
        expect(mockGetSavedResultDetail).toHaveBeenCalledWith('result-2');
      });
    });

    it('should display compare view when 2 results selected', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const compareButton = screen.getByText('결과 비교');
      await userEvent.click(compareButton);

      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      await userEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText('결과 비교')).toBeInTheDocument();
        expect(screen.getByText('개선됨')).toBeInTheDocument();
        expect(screen.getByText('악화됨')).toBeInTheDocument();
        expect(screen.getByText('변화 없음')).toBeInTheDocument();
      });
    });

    it('should close compare mode when cancel button clicked', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const compareButton = screen.getByText('결과 비교');
      await userEvent.click(compareButton);

      expect(screen.getByText('2개의 결과를 선택하세요')).toBeInTheDocument();

      const cancelButton = screen.getByText('비교 취소');
      await userEvent.click(cancelButton);

      expect(screen.queryByText('2개의 결과를 선택하세요')).not.toBeInTheDocument();
    });
  });

  describe('CSV Export', () => {
    it('should export result to CSV when export button clicked', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      const exportButtons = screen.getAllByText('내보내기');
      await userEvent.click(exportButtons[0]);

      await waitFor(() => {
        expect(mockGetSavedResultDetail).toHaveBeenCalledWith('result-1');
        expect(mockConvertToCSV).toHaveBeenCalled();
        expect(mockDownloadFile).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('CSV 다운로드가 시작되었습니다', 'success');
      });
    });
  });

  describe('Refresh', () => {
    it('should refresh list when refresh button clicked', async () => {
      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(screen.getByText('2025년 10월 정기 검증')).toBeInTheDocument();
      });

      mockGetSavedResults.mockClear();

      const refreshButton = screen.getByText('새로고침');
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockGetSavedResults).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('목록을 새로고침했습니다', 'info');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when API fails', async () => {
      const testError = new Error('API Error');
      mockGetSavedResults.mockRejectedValue(testError);
      mockHandleApiError.mockReturnValue({ message: 'API Error' });

      render(
          <SavedResults />
      );

      await waitFor(() => {
        expect(mockHandleApiError).toHaveBeenCalledWith(testError);
        expect(mockShowToast).toHaveBeenCalledWith('API Error', 'error');
      });
    });
  });
});
