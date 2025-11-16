/**
 * Status Display Utilities
 *
 * Provides utilities for displaying property statuses, crawl run statuses,
 * and issue information in a user-friendly format.
 */

import { PropertyStatus, CrawlRunStatus } from './constants';

/**
 * Get Korean label for status codes
 * @param {string} status - Status code
 * @returns {string} Korean label
 */
export const getStatusLabel = (status) => {
  const labels = {
    // Property statuses
    [PropertyStatus.NORMAL]: '정상',
    [PropertyStatus.ISSUE]: '이슈',
    [PropertyStatus.DEBUGGING]: '디버깅 중',

    // Crawl run statuses
    [CrawlRunStatus.RUNNING]: '실행 중',
    [CrawlRunStatus.COMPLETED]: '완료',
    [CrawlRunStatus.FAILED]: '실패',
    [CrawlRunStatus.CANCELLED]: '취소',
  };

  return labels[status] || status;
};

/**
 * Get color code for status
 * @param {string} status - Status code
 * @returns {string} Color name or hex code
 */
export const getStatusColor = (status) => {
  const colors = {
    // Property statuses
    [PropertyStatus.NORMAL]: 'green',
    [PropertyStatus.ISSUE]: 'red',
    [PropertyStatus.DEBUGGING]: 'orange',

    // Crawl run statuses
    [CrawlRunStatus.RUNNING]: 'blue',
    [CrawlRunStatus.COMPLETED]: 'green',
    [CrawlRunStatus.FAILED]: 'red',
    [CrawlRunStatus.CANCELLED]: 'gray',
  };

  return colors[status] || 'gray';
};

/**
 * Get CSS class for status badge
 * @param {string} status - Status code
 * @returns {string} CSS class name
 */
export const getStatusClass = (status) => {
  const classes = {
    [PropertyStatus.NORMAL]: 'status-normal',
    [PropertyStatus.ISSUE]: 'status-issue',
    [PropertyStatus.DEBUGGING]: 'status-debugging',
    [CrawlRunStatus.RUNNING]: 'status-running',
    [CrawlRunStatus.COMPLETED]: 'status-completed',
    [CrawlRunStatus.FAILED]: 'status-failed',
    [CrawlRunStatus.CANCELLED]: 'status-cancelled',
  };

  return classes[status] || 'status-default';
};

/**
 * Get Korean title for issue type
 * @param {string} issueType - Issue type code
 * @returns {string} Korean title
 */
export const getIssueTitle = (issueType) => {
  const titles = {
    'GA4_ID_MISMATCH': 'GA4 측정 ID 불일치',
    'GTM_ID_MISMATCH': 'GTM 컨테이너 ID 불일치',
    'GA4_NOT_DETECTED': 'GA4 미설치',
    'GTM_NOT_DETECTED': 'GTM 미설치',
    'PAGE_VIEW_NOT_FIRED': 'page_view 이벤트 미발생',
    'VALIDATION_ERROR': '검증 실패',
    'NETWORK_ERROR': '네트워크 오류',
    'TIMEOUT': '타임아웃',
    'PHASE1_TIMEOUT': 'Phase 1 타임아웃',
    'PHASE2_TIMEOUT': 'Phase 2 타임아웃',
  };

  return titles[issueType] || issueType;
};

/**
 * Get Korean description for issue type
 * @param {string} issueType - Issue type code
 * @returns {string} Korean description
 */
export const getIssueDescription = (issueType) => {
  const descriptions = {
    'GA4_ID_MISMATCH': '페이지에서 감지된 GA4 측정 ID가 기대값과 다릅니다.',
    'GTM_ID_MISMATCH': '페이지에서 감지된 GTM 컨테이너 ID가 기대값과 다릅니다.',
    'GA4_NOT_DETECTED': '페이지에서 GA4 스크립트를 찾을 수 없습니다.',
    'GTM_NOT_DETECTED': '페이지에서 GTM 스크립트를 찾을 수 없습니다.',
    'PAGE_VIEW_NOT_FIRED': 'page_view 이벤트가 발생하지 않았습니다.',
    'VALIDATION_ERROR': '설정 검증 중 오류가 발생했습니다.',
    'NETWORK_ERROR': '네트워크 연결에 문제가 있습니다.',
    'TIMEOUT': '설정된 시간 내에 응답을 받지 못했습니다.',
    'PHASE1_TIMEOUT': 'Phase 1 검증 단계에서 타임아웃이 발생했습니다.',
    'PHASE2_TIMEOUT': 'Phase 2 검증 단계에서 타임아웃이 발생했습니다.',
  };

  return descriptions[issueType] || '알 수 없는 이슈가 발생했습니다.';
};

/**
 * Get resolution guide for issue type
 * @param {string} issueType - Issue type code
 * @returns {string} Resolution guide (multi-line string)
 */
export const getResolutionGuide = (issueType) => {
  const guides = {
    'GA4_ID_MISMATCH':
      '1. GTM 태그 설정 확인\n2. 하드코딩된 GA4 스크립트 확인\n3. 환경 변수 확인\n4. 잘못된 GA4 ID가 다른 곳에서 로드되는지 확인',
    'GTM_ID_MISMATCH':
      '1. HTML 헤더의 GTM 스크립트 확인\n2. 배포 환경별 GTM ID 확인\n3. CDN 캐시 확인',
    'GA4_NOT_DETECTED':
      '1. GTM 컨테이너가 게시되었는지 확인\n2. 네트워크 탭에서 스크립트 로딩 확인\n3. GTM 태그가 활성화되어 있는지 확인',
    'GTM_NOT_DETECTED':
      '1. HTML 헤더에 GTM 스크립트 추가\n2. GTM 컨테이너 ID 확인\n3. 스크립트 로딩 순서 확인',
    'PAGE_VIEW_NOT_FIRED':
      '1. GTM 트리거 설정 확인\n2. 페이지 로드 완료 여부 확인\n3. dataLayer 이벤트 확인',
    'VALIDATION_ERROR':
      '1. 로그 확인\n2. 개발팀에 문의',
    'NETWORK_ERROR':
      '1. 인터넷 연결 확인\n2. 방화벽 설정 확인\n3. VPN 연결 확인',
    'TIMEOUT':
      '1. 페이지 로딩 속도 확인\n2. 타임아웃 설정 조정 고려\n3. 서버 응답 시간 확인',
    'PHASE1_TIMEOUT':
      '1. 페이지 초기 로딩 속도 개선\n2. GTM 컨테이너 로딩 확인',
    'PHASE2_TIMEOUT':
      '1. GA4/GTM 이벤트 발생 시간 확인\n2. 트리거 조건 확인',
  };

  return guides[issueType] || '개발팀에 문의하세요.';
};

/**
 * Get severity level for issue type
 * @param {string} issueType - Issue type code
 * @returns {string} Severity: 'critical' | 'warning' | 'info'
 */
export const getIssueSeverity = (issueType) => {
  const severities = {
    'GA4_ID_MISMATCH': 'critical',
    'GTM_ID_MISMATCH': 'critical',
    'GA4_NOT_DETECTED': 'critical',
    'GTM_NOT_DETECTED': 'critical',
    'PAGE_VIEW_NOT_FIRED': 'warning',
    'VALIDATION_ERROR': 'warning',
    'NETWORK_ERROR': 'warning',
    'TIMEOUT': 'warning',
    'PHASE1_TIMEOUT': 'warning',
    'PHASE2_TIMEOUT': 'warning',
  };

  return severities[issueType] || 'info';
};

/**
 * Get icon for issue severity
 * @param {string} severity - Severity level
 * @returns {string} Icon character
 */
export const getSeverityIcon = (severity) => {
  const icons = {
    'critical': '🔴',
    'warning': '⚠️',
    'info': 'ℹ️',
  };

  return icons[severity] || '•';
};

export default {
  getStatusLabel,
  getStatusColor,
  getStatusClass,
  getIssueTitle,
  getIssueDescription,
  getResolutionGuide,
  getIssueSeverity,
  getSeverityIcon,
};
