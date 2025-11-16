/**
 * Property Status Display Logic
 *
 * Determines how to display property status based on:
 * - Property Status (from status management): normal/issue/debugging
 * - Crawl Result (from validation): has_issues true/false
 */

/**
 * Calculate if a result has any issues (including GA4/GTM validation failures)
 *
 * @param {Object} result - Crawl result object
 * @returns {boolean} True if result has any issues (general issues OR GA4/GTM validation failures)
 */
export function calculateHasIssues(result) {
  // Check general issues array
  const hasGeneralIssues = result.issues && result.issues.length > 0;

  // Check GA4 validation failure (expected !== actual)
  const hasGA4Issue = result.ga4_validation &&
                      result.ga4_validation.expected &&
                      result.ga4_validation.actual &&
                      result.ga4_validation.expected !== result.ga4_validation.actual;

  // Check GTM validation failure (expected !== actual)
  const hasGTMIssue = result.gtm_validation &&
                      result.gtm_validation.expected &&
                      result.gtm_validation.actual &&
                      result.gtm_validation.expected !== result.gtm_validation.actual;

  return hasGeneralIssues || hasGA4Issue || hasGTMIssue;
}

/**
 * Get display status for a property based on management status and crawl results
 *
 * @param {string} propertyStatus - Property status from status management (normal/issue/debugging)
 * @param {boolean} hasIssues - Whether crawl result has issues
 * @param {number} issueCount - Number of issues found
 * @returns {Object} Display status with priority, label, message, icon, colorClass
 */
export function getPropertyDisplayStatus(propertyStatus, hasIssues, issueCount = 0) {
  // Normalize inputs
  const status = (propertyStatus || 'normal').toLowerCase();
  const issues = Boolean(hasIssues);

  /**
   * Priority (체크 순서):
   * 1. 디버깅 상태 체크 (debugging 상태는 크롤 결과와 관계없이 항상 "디버깅"으로 표시)
   * 2. 정상 → 오류 발생 (E - Priority 1 URGENT)
   * 3. 이슈 → 오류 (C - Priority 2)
   * 4. 이슈 → 정상 (D - Priority 4)
   * 5. 정상 → 정상 (F - Priority 5)
   *
   * Display Priority:
   * 1 (Highest): E - 정상 → 오류 발생 (새로운 오류)
   * 2: C - 이슈 → 오류 (수정 필요)
   * 3: B - 디버깅 → 정상 (확인 필요)
   * 4: D - 이슈 → 정상 (확인 필요)
   * 5: F - 정상 → 정상 (정상)
   * 6: A - 디버깅 → 디버깅 (디버깅 진행중)
   */

  // FIRST: Check if status is debugging - always show as debugging regardless of issues
  // Scenario A: 디버깅 → 디버깅 (Priority 6)
  if (status === 'debugging' && issues) {
    return {
      priority: 6,
      scenario: 'A',
      label: '디버깅중',
      shortLabel: '디버깅중',
      message: '디버깅 진행 중입니다',
      detailMessage: `${issueCount}개의 이슈에 대한 디버깅이 진행 중입니다.`,
      icon: '🔧',
      colorClass: 'debugging',
      needsAction: false
    };
  }

  // Scenario B: 디버깅 → 정상 (Priority 3)
  if (status === 'debugging' && !issues) {
    return {
      priority: 3,
      scenario: 'B',
      label: '확인 필요',
      shortLabel: '확인필요',
      message: '디버깅 중이었으나 정상 수집되고 있습니다. 상태를 확인해주세요',
      detailMessage: '디버깅 작업이 완료되었을 수 있습니다. 상태를 "정상"으로 변경하는 것을 검토해주세요.',
      icon: '✅⚠️',
      colorClass: 'check-needed',
      needsAction: true,
      actionType: 'status-review',
      actionLabel: '상태 확인',
      suggestedStatus: 'normal',
      blink: true
    };
  }

  // Scenario E: 정상 → 오류 발생 (Priority 1 - URGENT)
  if (status === 'normal' && issues) {
    return {
      priority: 1,
      scenario: 'E',
      label: '오류 발생',
      shortLabel: '오류발생',
      message: '정상이었으나 새로운 오류가 발생했습니다',
      detailMessage: `${issueCount}개의 새로운 오류가 감지되었습니다. 즉시 확인이 필요합니다.`,
      icon: '🚨',
      colorClass: 'urgent',
      needsAction: true,
      actionType: 'critical',
      actionLabel: '긴급 확인 필요',
      blink: true
    };
  }

  // Scenario C: 이슈 → 오류 (Priority 2)
  if (status === 'issue' && issues) {
    return {
      priority: 2,
      scenario: 'C',
      label: '오류',
      shortLabel: '오류',
      message: '수정 요청이 필요한 상태입니다',
      detailMessage: `${issueCount}개의 오류가 확인되어 수정이 필요합니다.`,
      icon: '❌',
      colorClass: 'error',
      needsAction: true,
      actionType: 'fix-required',
      actionLabel: '수정 필요'
    };
  }

  // Scenario D: 이슈 → 정상 (Priority 4)
  if (status === 'issue' && !issues) {
    return {
      priority: 4,
      scenario: 'D',
      label: '확인 필요',
      shortLabel: '확인필요',
      message: '이슈로 등록되었으나 정상 수집되고 있습니다. 상태를 확인해주세요',
      detailMessage: '이슈가 해결되었을 수 있습니다. 상태를 "정상"으로 변경하는 것을 검토해주세요.',
      icon: '✅⚠️',
      colorClass: 'check-needed',
      needsAction: true,
      actionType: 'status-review',
      actionLabel: '상태 확인',
      suggestedStatus: 'normal'
    };
  }

  // Scenario F: 정상 → 정상 (Priority 5 - Normal)
  if (status === 'normal' && !issues) {
    return {
      priority: 5,
      scenario: 'F',
      label: '정상',
      shortLabel: '정상',
      message: '정상적으로 수집되고 있습니다',
      detailMessage: '모든 검증이 통과되었으며 정상적으로 작동하고 있습니다.',
      icon: '✅',
      colorClass: 'normal',
      needsAction: false
    };
  }

  // Default fallback (should not reach here)
  return {
    priority: 99,
    scenario: 'UNKNOWN',
    label: '알 수 없음',
    shortLabel: '알수없음',
    message: '상태를 확인할 수 없습니다',
    detailMessage: '프로퍼티 상태를 확인해주세요.',
    icon: '❓',
    colorClass: 'unknown',
    needsAction: true,
    actionType: 'check',
    actionLabel: '확인 필요'
  };
}

/**
 * Get aggregated status counts for dashboard
 *
 * @param {Array} results - Array of crawl results with property info
 * @returns {Object} Counts by priority and action type
 */
export function getStatusCounts(results) {
  const counts = {
    urgent: 0,        // Priority 1: 오류 발생
    error: 0,         // Priority 2: 오류
    checkNeeded: 0,   // Priority 3-4: 확인 필요
    debugging: 0,     // Priority 6: 디버깅중
    normal: 0,        // Priority 5: 정상
    total: results.length
  };

  results.forEach(result => {
    const displayStatus = getPropertyDisplayStatus(
      result.properties?.current_status || result.property_status,
      result.has_issues,
      result.issues?.length || 0
    );

    switch (displayStatus.priority) {
      case 1: counts.urgent++; break;
      case 2: counts.error++; break;
      case 3:
      case 4: counts.checkNeeded++; break;
      case 6: counts.debugging++; break;
      case 5: counts.normal++; break;
      default: break;
    }
  });

  return counts;
}

/**
 * Sort results by priority (urgent first)
 *
 * @param {Array} results - Array of crawl results
 * @returns {Array} Sorted results
 */
export function sortByPriority(results) {
  return [...results].sort((a, b) => {
    const statusA = getPropertyDisplayStatus(
      a.properties?.current_status || a.property_status,
      a.has_issues,
      a.issues?.length || 0
    );
    const statusB = getPropertyDisplayStatus(
      b.properties?.current_status || b.property_status,
      b.has_issues,
      b.issues?.length || 0
    );

    return statusA.priority - statusB.priority;
  });
}

/**
 * Filter results by action needed
 *
 * @param {Array} results - Array of crawl results
 * @returns {Array} Results that need action
 */
export function filterActionNeeded(results) {
  return results.filter(result => {
    const displayStatus = getPropertyDisplayStatus(
      result.properties?.current_status || result.property_status,
      result.has_issues,
      result.issues?.length || 0
    );
    return displayStatus.needsAction;
  });
}

export default {
  calculateHasIssues,
  getPropertyDisplayStatus,
  getStatusCounts,
  sortByPriority,
  filterActionNeeded
};
