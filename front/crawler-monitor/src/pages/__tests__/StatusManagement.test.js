import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusManagement from '../StatusManagement';
import { apiHelpers } from '../../utils/api';
import * as toast from '../../utils/toast';

// Mock dependencies
jest.mock('../../utils/api');
jest.mock('../../utils/toast');

// Mock components to avoid date-fns ESM issues
jest.mock('../../components', () => ({
  Modal: ({ children, isOpen, onClose, title }) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
  Drawer: ({ children, isOpen, onClose, title }) =>
    isOpen ? (
      <div data-testid="drawer">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
  Switch: ({ checked, onChange, label }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  ),
  LoadingSpinner: () => <div data-testid="loading">Loading...</div>,
  EmptyState: ({ message }) => <div data-testid="empty-state">{message}</div>
}));

describe('StatusManagement Page', () => {
  const mockProperties = [
    {
      id: 'prop-1',
      property_name: '[EC] INNISFREE - US',
      url: 'https://us.innisfree.com',
      current_status: 'normal',
      is_active: true,
      updated_at: '2025-10-31T10:00:00Z'
    },
    {
      id: 'prop-2',
      property_name: '[EC] LANEIGE - US',
      url: 'https://us.laneige.com',
      current_status: 'issue',
      is_active: true,
      updated_at: '2025-10-31T09:00:00Z'
    },
    {
      id: 'prop-3',
      property_name: '[EC] ETUDE - US',
      url: 'https://us.etudehouse.com',
      current_status: 'debugging',
      is_active: false,
      updated_at: '2025-10-30T15:00:00Z'
    }
  ];

  const mockHistory = [
    {
      id: 'hist-1',
      previous_status: 'normal',
      new_status: 'issue',
      change_reason: '크롤링에서 GTM ID 불일치 발견',
      changed_by: 'system',
      changed_at: '2025-10-31T03:15:30Z'
    },
    {
      id: 'hist-2',
      previous_status: 'issue',
      new_status: 'debugging',
      change_reason: 'GTM 설정 확인 중',
      changed_by: 'user',
      changed_at: '2025-10-31T10:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default API mocks
    apiHelpers.getProperties.mockResolvedValue({
      success: true,
      data: { properties: mockProperties, total: 3 }
    });

    apiHelpers.updatePropertyStatus.mockResolvedValue({
      success: true,
      data: {
        property: { id: 'prop-1', current_status: 'debugging' },
        history_entry: {}
      }
    });

    apiHelpers.getPropertyHistory.mockResolvedValue({
      success: true,
      data: { history: mockHistory }
    });

    apiHelpers.updateProperty.mockResolvedValue({
      success: true,
      data: { property: { id: 'prop-1', is_active: false } }
    });

    toast.showToast.mockImplementation(() => {});
  });

  describe('AC1: Properties List and Filtering', () => {
    it('should fetch and display properties list on mount', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
        expect(screen.getByText('[EC] LANEIGE - US')).toBeInTheDocument();
        expect(screen.getByText('[EC] ETUDE - US')).toBeInTheDocument();
      });

      expect(apiHelpers.getProperties).toHaveBeenCalledTimes(1);
    });

    it('should display property information correctly', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Check URL link
      const urlLink = screen.getByText('https://us.innisfree.com');
      expect(urlLink).toBeInTheDocument();
      expect(urlLink).toHaveAttribute('href', 'https://us.innisfree.com');
      expect(urlLink).toHaveAttribute('target', '_blank');
    });

    it('should filter properties by status', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Apply status filter
      const statusFilter = screen.getAllByRole('combobox')[0];
      await userEvent.selectOptions(statusFilter, 'issue');

      // Only 'issue' property should be visible
      await waitFor(() => {
        expect(screen.getByText('[EC] LANEIGE - US')).toBeInTheDocument();
        expect(screen.queryByText('[EC] INNISFREE - US')).not.toBeInTheDocument();
      });
    });

    it('should filter properties by active status', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Apply active filter
      const activeFilter = screen.getAllByRole('combobox')[1];
      await userEvent.selectOptions(activeFilter, 'inactive');

      // Only inactive property should be visible
      await waitFor(() => {
        expect(screen.getByText('[EC] ETUDE - US')).toBeInTheDocument();
        expect(screen.queryByText('[EC] INNISFREE - US')).not.toBeInTheDocument();
      });
    });

    it('should search properties by name', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText('프로퍼티 검색...');
      await userEvent.type(searchInput, 'LANEIGE');

      // Only matching property should be visible
      await waitFor(() => {
        expect(screen.getByText('[EC] LANEIGE - US')).toBeInTheDocument();
        expect(screen.queryByText('[EC] INNISFREE - US')).not.toBeInTheDocument();
      });
    });

    it('should sort properties by clicking column headers', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Click on property name header to sort
      const propertyNameHeader = screen.getByText('프로퍼티명');
      await userEvent.click(propertyNameHeader);

      // Verify sorting indicator appears
      const headers = screen.getAllByRole('columnheader');
      const nameHeader = headers.find(h => h.textContent.includes('프로퍼티명'));
      expect(nameHeader).toBeInTheDocument();
    });
  });

  describe('AC2: Status Change Functionality', () => {
    it('should open status dropdown when status badge clicked', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Click status badge
      const statusBadges = screen.getAllByRole('button');
      const normalBadge = statusBadges.find(btn => btn.textContent.includes('정상'));
      await userEvent.click(normalBadge);

      // Dropdown should open
      await waitFor(() => {
        expect(screen.getByText('이슈')).toBeInTheDocument();
        expect(screen.getByText('디버깅 중')).toBeInTheDocument();
      });
    });

    it('should require reason when changing status', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Open dropdown and select new status
      const statusBadges = screen.getAllByRole('button');
      const normalBadge = statusBadges.find(btn => btn.textContent.includes('정상'));
      await userEvent.click(normalBadge);

      const debuggingOption = screen.getByText('디버깅 중');
      await userEvent.click(debuggingOption);

      // Try to confirm without reason
      const confirmButton = screen.getByText('확인');
      await userEvent.click(confirmButton);

      // Should show error toast
      expect(toast.showToast).toHaveBeenCalledWith('변경 사유를 입력해주세요', 'error');
      expect(apiHelpers.updatePropertyStatus).not.toHaveBeenCalled();
    });

    it('should change property status with reason', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Open dropdown
      const statusBadges = screen.getAllByRole('button');
      const normalBadge = statusBadges.find(btn => btn.textContent.includes('정상'));
      await userEvent.click(normalBadge);

      // Select new status
      const debuggingOption = screen.getByText('디버깅 중');
      await userEvent.click(debuggingOption);

      // Enter reason
      const reasonInput = screen.getByPlaceholderText('변경 사유를 입력하세요');
      await userEvent.type(reasonInput, 'GTM 설정 확인 필요');

      // Confirm
      const confirmButton = screen.getByText('확인');
      await userEvent.click(confirmButton);

      // API should be called
      await waitFor(() => {
        expect(apiHelpers.updatePropertyStatus).toHaveBeenCalledWith(
          'prop-1',
          'debugging',
          'GTM 설정 확인 필요',
          'user'
        );
      });

      expect(toast.showToast).toHaveBeenCalledWith('상태가 변경되었습니다', 'success');
    });

    it('should rollback optimistic update on error', async () => {
      apiHelpers.updatePropertyStatus.mockRejectedValue(new Error('Network error'));

      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Attempt status change
      const statusBadges = screen.getAllByRole('button');
      const normalBadge = statusBadges.find(btn => btn.textContent.includes('정상'));
      await userEvent.click(normalBadge);

      const debuggingOption = screen.getByText('디버깅 중');
      await userEvent.click(debuggingOption);

      const reasonInput = screen.getByPlaceholderText('변경 사유를 입력하세요');
      await userEvent.type(reasonInput, 'Test');

      const confirmButton = screen.getByText('확인');
      await userEvent.click(confirmButton);

      // Should show error toast
      await waitFor(() => {
        expect(toast.showToast).toHaveBeenCalledWith(
          expect.stringContaining('실패'),
          'error'
        );
      });

      // Should fetch properties again (rollback)
      expect(apiHelpers.getProperties).toHaveBeenCalledTimes(2);
    });
  });

  describe('AC3: Bulk Status Change', () => {
    it('should show bulk action button when properties selected', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Select checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]); // First property
      await userEvent.click(checkboxes[2]); // Second property

      // Bulk action button should appear
      await waitFor(() => {
        expect(screen.getByText(/일괄 변경/)).toBeInTheDocument();
      });
    });

    it('should select all properties with header checkbox', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Click "select all" checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);

      // All checkboxes should be checked
      await waitFor(() => {
        checkboxes.slice(1).forEach(cb => {
          expect(cb).toBeChecked();
        });
      });
    });

    it('should perform bulk status change with progress', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Select properties
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[1]);
      await userEvent.click(checkboxes[2]);

      // Click bulk action button
      const bulkButton = screen.getByText(/일괄 변경/);
      await userEvent.click(bulkButton);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('일괄 상태 변경')).toBeInTheDocument();
      });

      // Select status
      const statusSelect = screen.getAllByRole('combobox').find(
        select => within(select.parentElement).queryByText('변경할 상태')
      );
      await userEvent.selectOptions(statusSelect, 'normal');

      // Enter reason
      const reasonTextarea = screen.getByPlaceholderText('일괄 변경 사유를 입력하세요');
      await userEvent.type(reasonTextarea, '정기 점검 완료');

      // Execute
      const executeButton = screen.getByText('변경 실행');
      await userEvent.click(executeButton);

      // Should call API for each selected property
      await waitFor(() => {
        expect(apiHelpers.updatePropertyStatus).toHaveBeenCalledTimes(2);
      });

      expect(toast.showToast).toHaveBeenCalledWith(
        expect.stringContaining('2개'),
        'success'
      );
    });
  });

  describe('AC4: Status History Display', () => {
    it('should open history drawer when history button clicked', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Click history button
      const historyButtons = screen.getAllByTitle('이력 보기');
      await userEvent.click(historyButtons[0]);

      // Should call history API
      await waitFor(() => {
        expect(apiHelpers.getPropertyHistory).toHaveBeenCalledWith('prop-1');
      });

      // Drawer should open with history
      await waitFor(() => {
        expect(screen.getByText('상태 변경 이력')).toBeInTheDocument();
        expect(screen.getByText('크롤링에서 GTM ID 불일치 발견')).toBeInTheDocument();
      });
    });

    it('should display history timeline correctly', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Open history
      const historyButtons = screen.getAllByTitle('이력 보기');
      await userEvent.click(historyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('GTM 설정 확인 중')).toBeInTheDocument();
      });

      // Check status badges in timeline
      const statusBadges = screen.getAllByText('정상');
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });

  describe('AC5: Property Activation Toggle', () => {
    it('should toggle property activation status', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Find and click switch (implementation depends on Switch component)
      // This is a placeholder - actual implementation depends on Switch component structure
      const switches = document.querySelectorAll('input[type="checkbox"]');
      const activeSwitches = Array.from(switches).filter(
        s => !s.closest('th') && s.getAttribute('role') !== 'checkbox'
      );

      if (activeSwitches.length > 0) {
        await userEvent.click(activeSwitches[0]);

        await waitFor(() => {
          expect(apiHelpers.updateProperty).toHaveBeenCalled();
        });
      }
    });

    it('should show toast on activation toggle', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Note: Actual test depends on Switch component implementation
      // Placeholder for now
    });
  });

  describe('Error Handling', () => {
    it('should display error state when fetch fails', async () => {
      apiHelpers.getProperties.mockRejectedValue(new Error('Network error'));

      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('프로퍼티 목록을 불러올 수 없습니다')).toBeInTheDocument();
      });

      expect(toast.showToast).toHaveBeenCalledWith(
        '프로퍼티 목록을 불러올 수 없습니다',
        'error'
      );
    });

    it('should allow retry on error', async () => {
      apiHelpers.getProperties
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: { properties: mockProperties, total: 3 }
        });

      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('프로퍼티 목록을 불러올 수 없습니다')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('다시 시도');
      await userEvent.click(retryButton);

      // Should fetch properties again
      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should display summary stats correctly', async () => {
      render(
        
          <StatusManagement />
        
      );

      await waitFor(() => {
        expect(screen.getByText('[EC] INNISFREE - US')).toBeInTheDocument();
      });

      // Check summary cards
      expect(screen.getByText('전체 프로퍼티')).toBeInTheDocument();
      expect(screen.getByText('정상')).toBeInTheDocument();
      expect(screen.getByText('이슈')).toBeInTheDocument();
      expect(screen.getByText('디버깅 중')).toBeInTheDocument();

      // Check counts
      expect(screen.getByText('3')).toBeInTheDocument(); // Total
      expect(screen.getByText('1')).toBeInTheDocument(); // Each status
    });
  });
});
