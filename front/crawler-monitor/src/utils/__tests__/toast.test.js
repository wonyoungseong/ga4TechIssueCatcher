/**
 * Unit Tests for toast.js
 *
 * Tests all toast notification utilities
 */

import toast from 'react-hot-toast';
import {
  showToast,
  showSuccess,
  showError,
  showWarning,
  showInfo,
} from '../toast';

// Mock react-hot-toast
jest.mock('react-hot-toast');

describe('toast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showToast', () => {
    it('should call toast.success for success type', () => {
      showToast('Success message', 'success');
      expect(toast.success).toHaveBeenCalledWith('Success message', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should call toast.error for error type', () => {
      showToast('Error message', 'error');
      expect(toast.error).toHaveBeenCalledWith('Error message', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should call toast with warning icon for warning type', () => {
      showToast('Warning message', 'warning');
      expect(toast).toHaveBeenCalledWith('Warning message', expect.objectContaining({
        icon: '⚠️',
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should call toast for info type (default)', () => {
      showToast('Info message', 'info');
      expect(toast).toHaveBeenCalledWith('Info message', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should use info as default type when not specified', () => {
      showToast('Default message');
      expect(toast).toHaveBeenCalledWith('Default message', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should merge custom options with defaults', () => {
      showToast('Custom message', 'success', {
        duration: 5000,
        position: 'bottom-center',
        custom: 'option',
      });
      expect(toast.success).toHaveBeenCalledWith('Custom message', expect.objectContaining({
        duration: 5000,
        position: 'bottom-center',
        custom: 'option',
      }));
    });

    it('should handle empty message', () => {
      showToast('', 'success');
      expect(toast.success).toHaveBeenCalledWith('', expect.any(Object));
    });

    it('should handle long messages', () => {
      const longMessage = 'A'.repeat(500);
      showToast(longMessage, 'info');
      expect(toast).toHaveBeenCalledWith(longMessage, expect.any(Object));
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Test 🔥 & <div>HTML</div> "quotes"';
      showToast(specialMessage, 'warning');
      expect(toast).toHaveBeenCalledWith(specialMessage, expect.any(Object));
    });
  });

  describe('showSuccess', () => {
    it('should call showToast with success type', () => {
      showSuccess('Success!');
      expect(toast.success).toHaveBeenCalledWith('Success!', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should pass through custom options', () => {
      showSuccess('Success!', { duration: 3000 });
      expect(toast.success).toHaveBeenCalledWith('Success!', expect.objectContaining({
        duration: 3000,
        position: 'top-right',
      }));
    });
  });

  describe('showError', () => {
    it('should call showToast with error type', () => {
      showError('Error occurred');
      expect(toast.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should pass through custom options', () => {
      showError('Error occurred', { duration: 6000 });
      expect(toast.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        duration: 6000,
        position: 'top-right',
      }));
    });
  });

  describe('showWarning', () => {
    it('should call showToast with warning type', () => {
      showWarning('Warning!');
      expect(toast).toHaveBeenCalledWith('Warning!', expect.objectContaining({
        icon: '⚠️',
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should pass through custom options', () => {
      showWarning('Warning!', { duration: 5000, custom: 'value' });
      expect(toast).toHaveBeenCalledWith('Warning!', expect.objectContaining({
        icon: '⚠️',
        duration: 5000,
        position: 'top-right',
        custom: 'value',
      }));
    });
  });

  describe('showInfo', () => {
    it('should call showToast with info type', () => {
      showInfo('Information');
      expect(toast).toHaveBeenCalledWith('Information', expect.objectContaining({
        duration: 4000,
        position: 'top-right',
      }));
    });

    it('should pass through custom options', () => {
      showInfo('Information', { duration: 2000 });
      expect(toast).toHaveBeenCalledWith('Information', expect.objectContaining({
        duration: 2000,
        position: 'top-right',
      }));
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle rapid successive toasts', () => {
      showSuccess('First');
      showError('Second');
      showWarning('Third');

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledTimes(1);
    });

    it('should handle Korean text messages', () => {
      const koreanMessage = '성공적으로 저장되었습니다';
      showSuccess(koreanMessage);
      expect(toast.success).toHaveBeenCalledWith(koreanMessage, expect.any(Object));
    });

    it('should handle multiline messages', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      showInfo(multilineMessage);
      expect(toast).toHaveBeenCalledWith(multilineMessage, expect.any(Object));
    });

    it('should handle undefined and null options gracefully', () => {
      showToast('Test', 'success', undefined);
      expect(toast.success).toHaveBeenCalled();

      jest.clearAllMocks();

      showToast('Test', 'success', null);
      expect(toast.success).toHaveBeenCalled();
    });

    it('should maintain config object structure', () => {
      showToast('Test', 'success', { custom: 'value' });
      const callArgs = toast.success.mock.calls[0][1];

      expect(callArgs).toHaveProperty('duration');
      expect(callArgs).toHaveProperty('position');
      expect(callArgs).toHaveProperty('custom');
    });

    it('should handle all toast types in sequence', () => {
      showSuccess('1');
      showError('2');
      showWarning('3');
      showInfo('4');

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast).toHaveBeenCalledTimes(2); // warning and info
    });
  });

  describe('Configuration Options', () => {
    it('should respect position option', () => {
      const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

      positions.forEach(position => {
        jest.clearAllMocks();
        showToast('Test', 'info', { position });
        expect(toast).toHaveBeenCalledWith('Test', expect.objectContaining({ position }));
      });
    });

    it('should respect duration option', () => {
      showToast('Test', 'success', { duration: 10000 });
      expect(toast.success).toHaveBeenCalledWith('Test', expect.objectContaining({
        duration: 10000,
      }));
    });

    it('should allow duration: Infinity for persistent toast', () => {
      showToast('Persistent', 'warning', { duration: Infinity });
      expect(toast).toHaveBeenCalledWith('Persistent', expect.objectContaining({
        duration: Infinity,
      }));
    });

    it('should allow custom icon override', () => {
      showToast('Custom icon', 'success', { icon: '🎉' });
      expect(toast.success).toHaveBeenCalledWith('Custom icon', expect.objectContaining({
        icon: '🎉',
      }));
    });
  });
});
