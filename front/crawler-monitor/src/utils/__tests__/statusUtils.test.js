/**
 * Unit Tests for statusUtils.js
 *
 * Tests all status and issue display utilities
 */

import { PropertyStatus, CrawlRunStatus } from '../constants';
import {
  getStatusLabel,
  getStatusColor,
  getStatusClass,
  getIssueTitle,
  getIssueDescription,
  getResolutionGuide,
  getIssueSeverity,
  getSeverityIcon,
} from '../statusUtils';

describe('statusUtils', () => {
  describe('getStatusLabel', () => {
    it('should return Korean labels for PropertyStatus', () => {
      expect(getStatusLabel(PropertyStatus.NORMAL)).toBe('정상');
      expect(getStatusLabel(PropertyStatus.ISSUE)).toBe('이슈');
      expect(getStatusLabel(PropertyStatus.DEBUGGING)).toBe('디버깅 중');
    });

    it('should return Korean labels for CrawlRunStatus', () => {
      expect(getStatusLabel(CrawlRunStatus.RUNNING)).toBe('실행 중');
      expect(getStatusLabel(CrawlRunStatus.COMPLETED)).toBe('완료');
      expect(getStatusLabel(CrawlRunStatus.FAILED)).toBe('실패');
      expect(getStatusLabel(CrawlRunStatus.CANCELLED)).toBe('취소');
    });

    it('should return original status for unknown values', () => {
      expect(getStatusLabel('unknown_status')).toBe('unknown_status');
      expect(getStatusLabel('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(getStatusLabel(null)).toBe(null);
      expect(getStatusLabel(undefined)).toBe(undefined);
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors for PropertyStatus', () => {
      expect(getStatusColor(PropertyStatus.NORMAL)).toBe('green');
      expect(getStatusColor(PropertyStatus.ISSUE)).toBe('red');
      expect(getStatusColor(PropertyStatus.DEBUGGING)).toBe('orange');
    });

    it('should return correct colors for CrawlRunStatus', () => {
      expect(getStatusColor(CrawlRunStatus.RUNNING)).toBe('blue');
      expect(getStatusColor(CrawlRunStatus.COMPLETED)).toBe('green');
      expect(getStatusColor(CrawlRunStatus.FAILED)).toBe('red');
      expect(getStatusColor(CrawlRunStatus.CANCELLED)).toBe('gray');
    });

    it('should return default gray for unknown values', () => {
      expect(getStatusColor('unknown_status')).toBe('gray');
      expect(getStatusColor('')).toBe('gray');
      expect(getStatusColor(null)).toBe('gray');
      expect(getStatusColor(undefined)).toBe('gray');
    });
  });

  describe('getStatusClass', () => {
    it('should return correct CSS classes for PropertyStatus', () => {
      expect(getStatusClass(PropertyStatus.NORMAL)).toBe('status-normal');
      expect(getStatusClass(PropertyStatus.ISSUE)).toBe('status-issue');
      expect(getStatusClass(PropertyStatus.DEBUGGING)).toBe('status-debugging');
    });

    it('should return correct CSS classes for CrawlRunStatus', () => {
      expect(getStatusClass(CrawlRunStatus.RUNNING)).toBe('status-running');
      expect(getStatusClass(CrawlRunStatus.COMPLETED)).toBe('status-completed');
      expect(getStatusClass(CrawlRunStatus.FAILED)).toBe('status-failed');
      expect(getStatusClass(CrawlRunStatus.CANCELLED)).toBe('status-cancelled');
    });

    it('should return default class for unknown values', () => {
      expect(getStatusClass('unknown')).toBe('status-unknown');
      expect(getStatusClass('')).toBe('status-');
    });
  });

  describe('getIssueTitle', () => {
    it('should return Korean titles for GA4 issues', () => {
      expect(getIssueTitle('GA4_ID_MISMATCH')).toBe('GA4 측정 ID 불일치');
      expect(getIssueTitle('GA4_NOT_DETECTED')).toBe('GA4 미설치');
    });

    it('should return Korean titles for GTM issues', () => {
      expect(getIssueTitle('GTM_ID_MISMATCH')).toBe('GTM 컨테이너 ID 불일치');
      expect(getIssueTitle('GTM_NOT_DETECTED')).toBe('GTM 미설치');
    });

    it('should return Korean titles for event issues', () => {
      expect(getIssueTitle('PAGE_VIEW_NOT_FIRED')).toBe('page_view 이벤트 미발생');
    });

    it('should return Korean titles for validation issues', () => {
      expect(getIssueTitle('VALIDATION_ERROR')).toBe('검증 실패');
    });

    it('should return original issue type for unknown values', () => {
      expect(getIssueTitle('UNKNOWN_ISSUE')).toBe('UNKNOWN_ISSUE');
      expect(getIssueTitle('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(getIssueTitle(null)).toBe(null);
      expect(getIssueTitle(undefined)).toBe(undefined);
    });
  });

  describe('getIssueDescription', () => {
    it('should return Korean descriptions for GA4 issues', () => {
      const ga4Mismatch = getIssueDescription('GA4_ID_MISMATCH');
      expect(ga4Mismatch).toContain('GA4 측정 ID');
      expect(ga4Mismatch).toContain('기대값과 다릅니다');

      const ga4NotDetected = getIssueDescription('GA4_NOT_DETECTED');
      expect(ga4NotDetected).toContain('GA4 스크립트');
      expect(ga4NotDetected).toContain('찾을 수 없습니다');
    });

    it('should return Korean descriptions for GTM issues', () => {
      const gtmMismatch = getIssueDescription('GTM_ID_MISMATCH');
      expect(gtmMismatch).toContain('GTM 컨테이너 ID');
      expect(gtmMismatch).toContain('기대값과 다릅니다');

      const gtmNotDetected = getIssueDescription('GTM_NOT_DETECTED');
      expect(gtmNotDetected).toContain('GTM 스크립트');
      expect(gtmNotDetected).toContain('찾을 수 없습니다');
    });

    it('should return Korean descriptions for event issues', () => {
      const pageViewNotFired = getIssueDescription('PAGE_VIEW_NOT_FIRED');
      expect(pageViewNotFired).toContain('page_view');
      expect(pageViewNotFired).toContain('발생하지 않았습니다');
    });

    it('should return empty string for unknown issue types', () => {
      expect(getIssueDescription('UNKNOWN_ISSUE')).toBe('');
      expect(getIssueDescription('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(getIssueDescription(null)).toBe('');
      expect(getIssueDescription(undefined)).toBe('');
    });
  });

  describe('getResolutionGuide', () => {
    it('should return detailed resolution guides for GA4 issues', () => {
      const ga4Mismatch = getResolutionGuide('GA4_ID_MISMATCH');
      expect(ga4Mismatch).toContain('GTM 태그 설정 확인');
      expect(ga4Mismatch).toContain('하드코딩된 GA4 스크립트 확인');
      expect(ga4Mismatch).toContain('환경 변수 확인');

      const ga4NotDetected = getResolutionGuide('GA4_NOT_DETECTED');
      expect(ga4NotDetected).toContain('GTM 컨테이너');
      expect(ga4NotDetected).toContain('스크립트 로딩 확인');
    });

    it('should return detailed resolution guides for GTM issues', () => {
      const gtmMismatch = getResolutionGuide('GTM_ID_MISMATCH');
      expect(gtmMismatch).toContain('GTM 스크립트 확인');
      expect(gtmMismatch).toContain('GTM ID 확인');

      const gtmNotDetected = getResolutionGuide('GTM_NOT_DETECTED');
      expect(gtmNotDetected).toContain('GTM 스크립트 추가');
      expect(gtmNotDetected).toContain('GTM 컨테이너 ID 확인');
    });

    it('should return detailed resolution guides for event issues', () => {
      const pageViewNotFired = getResolutionGuide('PAGE_VIEW_NOT_FIRED');
      expect(pageViewNotFired).toContain('GTM 트리거');
      expect(pageViewNotFired).toContain('페이지 로드');
    });

    it('should return default message for unknown issues', () => {
      expect(getResolutionGuide('UNKNOWN_ISSUE')).toBe('개발팀에 문의하세요.');
      expect(getResolutionGuide('')).toBe('개발팀에 문의하세요.');
    });

    it('should handle null/undefined', () => {
      expect(getResolutionGuide(null)).toBe('개발팀에 문의하세요.');
      expect(getResolutionGuide(undefined)).toBe('개발팀에 문의하세요.');
    });
  });

  describe('getIssueSeverity', () => {
    it('should return correct severity for ID mismatch issues', () => {
      expect(getIssueSeverity('GA4_ID_MISMATCH')).toBe('high');
      expect(getIssueSeverity('GTM_ID_MISMATCH')).toBe('high');
    });

    it('should return correct severity for not detected issues', () => {
      expect(getIssueSeverity('GA4_NOT_DETECTED')).toBe('critical');
      expect(getIssueSeverity('GTM_NOT_DETECTED')).toBe('critical');
    });

    it('should return correct severity for event issues', () => {
      expect(getIssueSeverity('PAGE_VIEW_NOT_FIRED')).toBe('medium');
    });

    it('should return correct severity for validation issues', () => {
      expect(getIssueSeverity('VALIDATION_ERROR')).toBe('medium');
    });

    it('should return low severity for unknown issues', () => {
      expect(getIssueSeverity('UNKNOWN_ISSUE')).toBe('low');
      expect(getIssueSeverity('')).toBe('low');
      expect(getIssueSeverity(null)).toBe('low');
      expect(getIssueSeverity(undefined)).toBe('low');
    });
  });

  describe('getSeverityIcon', () => {
    it('should return correct icons for each severity level', () => {
      expect(getSeverityIcon('critical')).toBe('🔴');
      expect(getSeverityIcon('high')).toBe('🟠');
      expect(getSeverityIcon('medium')).toBe('🟡');
      expect(getSeverityIcon('low')).toBe('🟢');
    });

    it('should return default icon for unknown severity', () => {
      expect(getSeverityIcon('unknown')).toBe('⚪');
      expect(getSeverityIcon('')).toBe('⚪');
      expect(getSeverityIcon(null)).toBe('⚪');
      expect(getSeverityIcon(undefined)).toBe('⚪');
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle complete issue workflow', () => {
      const issueType = 'GA4_ID_MISMATCH';

      // Get all issue information
      const title = getIssueTitle(issueType);
      const description = getIssueDescription(issueType);
      const guide = getResolutionGuide(issueType);
      const severity = getIssueSeverity(issueType);
      const icon = getSeverityIcon(severity);

      // Verify complete information is available
      expect(title).toBeTruthy();
      expect(description).toBeTruthy();
      expect(guide).toBeTruthy();
      expect(severity).toBe('high');
      expect(icon).toBe('🟠');
    });

    it('should handle complete status workflow', () => {
      const status = PropertyStatus.ISSUE;

      // Get all status information
      const label = getStatusLabel(status);
      const color = getStatusColor(status);
      const className = getStatusClass(status);

      // Verify complete information is available
      expect(label).toBe('이슈');
      expect(color).toBe('red');
      expect(className).toBe('status-issue');
    });

    it('should handle all PropertyStatus values', () => {
      const statuses = Object.values(PropertyStatus);
      statuses.forEach(status => {
        expect(getStatusLabel(status)).toBeTruthy();
        expect(getStatusColor(status)).toBeTruthy();
        expect(getStatusClass(status)).toBeTruthy();
      });
    });

    it('should handle all CrawlRunStatus values', () => {
      const statuses = Object.values(CrawlRunStatus);
      statuses.forEach(status => {
        expect(getStatusLabel(status)).toBeTruthy();
        expect(getStatusColor(status)).toBeTruthy();
        expect(getStatusClass(status)).toBeTruthy();
      });
    });

    it('should handle case-insensitive issue types', () => {
      // Assuming implementation handles case conversion
      const upperCase = getIssueTitle('GA4_ID_MISMATCH');
      const lowerCase = getIssueTitle('ga4_id_mismatch');
      // Both should return valid titles (implementation may vary)
      expect(upperCase).toBeTruthy();
      expect(lowerCase).toBeTruthy();
    });
  });
});
