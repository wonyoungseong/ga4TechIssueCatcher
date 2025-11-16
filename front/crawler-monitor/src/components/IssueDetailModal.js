/**
 * IssueDetailModal Component - Story 9.4 Task 5
 *
 * Displays detailed information about validation issues:
 * - Issue type descriptions
 * - Expected vs actual value comparison
 * - Screenshot viewer
 * - Resolution guides
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Book,
  Image as ImageIcon,
  X,
  Settings
} from 'lucide-react';
import Modal from './Modal';
import { apiHelpers } from '../utils/api';
import { showToast } from '../utils/toast';
import { getPropertyDisplayStatus } from '../utils/propertyStatusUtils';
import './IssueDetailModal.css';

function IssueDetailModal({ isOpen, onClose, result }) {
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [propertyStatus, setPropertyStatus] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [hasConsentMode, setHasConsentMode] = useState(false); // Story 10.2
  const [statusLoading, setStatusLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [updatingConsentMode, setUpdatingConsentMode] = useState(false); // Story 10.2

  /**
   * Close screenshot modal
   */
  const closeScreenshotModal = () => {
    setSelectedScreenshot(null);
  };

  // Fetch current property status when modal opens
  useEffect(() => {
    if (isOpen && result?.property_id) {
      fetchPropertyStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, result?.property_id]);

  // Debug: Log when hasConsentMode changes - Story 10.2
  useEffect(() => {
    console.log('[IssueDetailModal] hasConsentMode state changed to:', hasConsentMode);
    console.log('[IssueDetailModal] Button will have class:', hasConsentMode ? 'enabled' : 'disabled');
  }, [hasConsentMode]);

  // Handle ESC key for screenshot viewer
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && selectedScreenshot) {
        // If screenshot is open, close only screenshot and prevent modal from closing
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeScreenshotModal();
      }
    };

    if (selectedScreenshot) {
      // Use capture phase to intercept event before it reaches Modal component
      document.addEventListener('keydown', handleEscKey, true);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey, true);
    };
  }, [selectedScreenshot]);

  // Handle ESC key for property detail modal - prevent propagation to parent RunDetailModal
  useEffect(() => {
    const handlePropertyModalEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !selectedScreenshot) {
        // If property detail is open but screenshot is NOT open,
        // close only this modal and prevent event from reaching RunDetailModal
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    if (isOpen && !selectedScreenshot) {
      // Use capture phase to intercept event before it reaches parent modal
      document.addEventListener('keydown', handlePropertyModalEsc, true);
    }

    return () => {
      document.removeEventListener('keydown', handlePropertyModalEsc, true);
    };
  }, [isOpen, selectedScreenshot, onClose]);

  /**
   * Fetch current property status from API
   */
  const fetchPropertyStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await apiHelpers.getProperty(result.property_id);
      if (response.success && response.data) {
        console.log('[IssueDetailModal] Property data:', response.data); // Debug log
        console.log('[IssueDetailModal] has_consent_mode value:', response.data.has_consent_mode); // Debug log
        setPropertyStatus(response.data.current_status);
        setIsActive(response.data.is_active !== false); // Default to true if undefined
        setHasConsentMode(response.data.has_consent_mode === true); // Story 10.2: Default to false
        console.log('[IssueDetailModal] hasConsentMode state set to:', response.data.has_consent_mode === true); // Debug log
      }
    } catch (error) {
      console.error('[IssueDetailModal] Failed to fetch property status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  /**
   * Handle status change
   */
  const handleStatusChange = async (newStatus) => {
    if (!result?.property_id || updatingStatus) return;

    setUpdatingStatus(true);
    const previousStatus = propertyStatus;

    // Optimistic update
    setPropertyStatus(newStatus);

    try {
      const response = await apiHelpers.updatePropertyStatus(
        result.property_id,
        newStatus,
        `리포트에서 상태 변경 (이슈 ${result.issues?.length || 0}개)`,
        'reports_page'
      );

      if (response.success) {
        showToast('프로퍼티 상태가 업데이트되었습니다', 'success');
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      // Rollback on error
      setPropertyStatus(previousStatus);
      showToast('상태 업데이트에 실패했습니다', 'error');
      console.error('[IssueDetailModal] Failed to update status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  /**
   * Handle property activation toggle
   */
  const handleActivationToggle = async () => {
    if (!result?.property_id || updatingActive) return;

    const newActiveState = !isActive;
    const previousState = isActive;

    setUpdatingActive(true);
    // Optimistic update
    setIsActive(newActiveState);

    try {
      const response = await apiHelpers.updateProperty(result.property_id, {
        is_active: newActiveState
      });

      if (response.success) {
        showToast(
          newActiveState ? '프로퍼티가 활성화되었습니다' : '프로퍼티가 비활성화되었습니다',
          'success'
        );
      } else {
        throw new Error('Failed to update activation status');
      }
    } catch (error) {
      // Rollback on error
      setIsActive(previousState);
      showToast('활성화 상태 업데이트에 실패했습니다', 'error');
      console.error('[IssueDetailModal] Failed to update activation:', error);
    } finally {
      setUpdatingActive(false);
    }
  };

  /**
   * Handle Consent Mode toggle - Story 10.2
   */
  const handleConsentModeToggle = async () => {
    if (!result?.property_id || updatingConsentMode) return;

    const newConsentModeState = !hasConsentMode;
    const previousState = hasConsentMode;

    setUpdatingConsentMode(true);
    // Optimistic update
    setHasConsentMode(newConsentModeState);

    try {
      const response = await apiHelpers.updateProperty(result.property_id, {
        has_consent_mode: newConsentModeState
      });

      if (response.success) {
        showToast(
          newConsentModeState ? 'Consent Mode가 활성화되었습니다' : 'Consent Mode가 비활성화되었습니다',
          'success'
        );
      } else {
        throw new Error('Failed to update Consent Mode status');
      }
    } catch (error) {
      // Rollback on error
      setHasConsentMode(previousState);
      showToast('Consent Mode 상태 업데이트에 실패했습니다', 'error');
      console.error('[IssueDetailModal] Failed to update Consent Mode:', error);
    } finally {
      setUpdatingConsentMode(false);
    }
  };

  if (!result) return null;

  /**
   * Get issue type description
   */
  const getIssueTypeDescription = (issueType) => {
    const descriptions = {
      ga4_mismatch: {
        title: 'GA4 ID 불일치',
        description: 'Google Analytics 4 측정 ID가 설정된 값과 다릅니다.',
        severity: 'high',
      },
      gtm_mismatch: {
        title: 'GTM ID 불일치',
        description: 'Google Tag Manager 컨테이너 ID가 설정된 값과 다릅니다.',
        severity: 'high',
      },
      ga4_missing: {
        title: 'GA4 ID 누락',
        description: 'Google Analytics 4 측정 ID가 페이지에서 감지되지 않았습니다.',
        severity: 'critical',
      },
      gtm_missing: {
        title: 'GTM ID 누락',
        description: 'Google Tag Manager 컨테이너 ID가 페이지에서 감지되지 않았습니다.',
        severity: 'critical',
      },
      multiple_ga4: {
        title: '중복 GA4 ID',
        description: '하나의 페이지에 여러 GA4 측정 ID가 감지되었습니다.',
        severity: 'medium',
      },
      multiple_gtm: {
        title: '중복 GTM ID',
        description: '하나의 페이지에 여러 GTM 컨테이너 ID가 감지되었습니다.',
        severity: 'medium',
      },
      consent_mode_basic_detected: {
        title: 'Consent Mode로 인한 GA4 차단',
        description: 'GTM에 GA4가 설정되어 있으나, Consent Mode Basic으로 인해 모든 데이터 수집이 차단되었습니다. 사용자가 쿠키 동의를 거부한 경우 정상적인 동작입니다.',
        severity: 'info',
      },
      no_ga4_events: {
        title: 'GA4 이벤트 미감지',
        description: 'Consent Mode 사용 중 사용자 동의 거부로 GA4 이벤트가 전송되지 않았습니다.',
        severity: 'info',
      },
    };

    return descriptions[issueType] || {
      title: '알 수 없는 이슈',
      description: '이슈 유형을 확인할 수 없습니다.',
      severity: 'low',
    };
  };

  /**
   * Get resolution guide link
   */
  const getResolutionGuide = (issueType) => {
    const guides = {
      ga4_mismatch: 'https://support.google.com/analytics/answer/9304153',
      gtm_mismatch: 'https://support.google.com/tagmanager/answer/6103696',
      ga4_missing: 'https://support.google.com/analytics/answer/9304153',
      gtm_missing: 'https://support.google.com/tagmanager/answer/6103696',
      multiple_ga4: 'https://support.google.com/analytics/answer/9304153',
      multiple_gtm: 'https://support.google.com/tagmanager/answer/6103696',
      consent_mode_basic_detected: '#',  // Internal guide or wiki link
      no_ga4_events: '#',  // Internal guide or wiki link
    };

    return guides[issueType] || 'https://support.google.com/analytics';
  };

  /**
   * Get severity icon
   */
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <XCircle size={20} className="severity-critical" />;
      case 'high':
        return <AlertCircle size={20} className="severity-high" />;
      case 'medium':
        return <AlertCircle size={20} className="severity-medium" />;
      case 'info':
        return <Info size={20} className="severity-info" />;
      default:
        return <CheckCircle size={20} className="severity-low" />;
    }
  };

  /**
   * Handle screenshot view
   */
  const handleViewScreenshot = () => {
    // Prefer screenshot_url (Supabase Storage public URL)
    // Fallback to screenshot_path for backward compatibility
    if (result.screenshot_url) {
      setSelectedScreenshot(result.screenshot_url);
    } else if (result.screenshot_path) {
      const screenshotUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/${result.screenshot_path}`;
      setSelectedScreenshot(screenshotUrl);
    }
  };

  const hasIssues = result.issues && result.issues.length > 0;

  return (
    <>
      {/* Main Issue Detail Modal */}
      <Modal
        isOpen={isOpen && !selectedScreenshot}
        onClose={onClose}
        title="검증 결과 상세"
        size="large"
      >
        <div className="issue-detail-content">
          {/* Scenario-based Status Alert */}
          {propertyStatus && (() => {
            const displayStatus = getPropertyDisplayStatus(
              propertyStatus,
              result.has_issues,
              result.issues?.length || 0
            );

            // Only show alert for scenarios that need action
            if (displayStatus.needsAction) {
              return (
                <div className={`scenario-alert scenario-alert-${displayStatus.colorClass} ${displayStatus.blink ? 'blink-animation' : ''}`}>
                  <div className="scenario-alert-header">
                    <span className="scenario-alert-icon">{displayStatus.icon}</span>
                    <span className="scenario-alert-title">{displayStatus.label}</span>
                    {displayStatus.actionLabel && (
                      <span className="scenario-alert-badge">{displayStatus.actionLabel}</span>
                    )}
                  </div>
                  <p className="scenario-alert-message">{displayStatus.message}</p>
                  <p className="scenario-alert-detail">{displayStatus.detailMessage}</p>
                  {displayStatus.suggestedStatus && (
                    <div className="scenario-alert-action">
                      <AlertCircle size={16} />
                      <span>
                        상태를 "<strong>{displayStatus.suggestedStatus === 'normal' ? '정상' : displayStatus.suggestedStatus}</strong>"으로 변경하는 것을 검토해주세요.
                      </span>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Property Information */}
          <div className="property-info-section">
            <h3 className="section-title">프로퍼티 정보</h3>
            <div className="property-details">
              <div className="property-detail-item">
                <span className="detail-label">프로퍼티명:</span>
                <span className="detail-value">{result.property_name || 'N/A'}</span>
              </div>
              <div className="property-detail-item">
                <span className="detail-label">URL:</span>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="detail-url"
                >
                  {result.url}
                  <ExternalLink size={14} />
                </a>
              </div>
              <div className="property-detail-item">
                <span className="detail-label">검증 결과:</span>
                <span className={`status-badge status-${result.validation_status}`}>
                  {result.validation_status === 'success' ? '성공' : '실패'}
                </span>
              </div>
              <div className="property-detail-item">
                <span className="detail-label">이슈 개수:</span>
                <span className="detail-value">
                  {result.issues?.length || 0}개
                  {result.issues?.length > 0 && (
                    <span style={{ marginLeft: '8px', color: 'var(--error-text)' }}>
                      ⚠️
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="property-actions">
              <a
                href={`http://localhost:3001/settings?property_id=${result.property_id || ''}&property_name=${encodeURIComponent(result.property_name || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="supabase-studio-button"
              >
                <Settings size={16} />
                설정 페이지 열기
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Property Status Management */}
          <div className="property-status-section">
            <h3 className="section-title">프로퍼티 상태 관리</h3>
            {statusLoading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                상태 로딩 중...
              </div>
            ) : (
              <div className="status-management-controls">
                {/* Property Activation Toggle */}
                <div className="activation-toggle-container">
                  <div className="activation-status-display">
                    <span className="detail-label">사이트 수집:</span>
                    <span className={`activation-badge ${isActive ? 'active' : 'inactive'}`}>
                      {isActive ? '활성화' : '비활성화'}
                    </span>
                  </div>
                  <button
                    className={`activation-toggle-button ${isActive ? 'active' : 'inactive'}`}
                    onClick={handleActivationToggle}
                    disabled={updatingActive}
                  >
                    <span className="toggle-slider">
                      <span className="toggle-thumb"></span>
                    </span>
                    <span className="toggle-label">
                      {updatingActive ? '처리중...' : (isActive ? '비활성화' : '활성화')}
                    </span>
                  </button>
                  {result.issues?.length > 0 && isActive && (
                    <div className="activation-warning">
                      <AlertCircle size={14} />
                      <span>이슈가 발견되었습니다. 비활성화하여 수집을 중지할 수 있습니다.</span>
                    </div>
                  )}
                </div>

                {/* Consent Mode Toggle - Story 10.2 */}
                <div className="consent-mode-toggle-container">
                  <div className="consent-mode-status-display">
                    <span className="detail-label">Consent Mode:</span>
                    <span className={`consent-mode-badge ${hasConsentMode ? 'enabled' : 'disabled'}`}>
                      {hasConsentMode ? '사용' : '미사용'}
                    </span>
                  </div>
                  <button
                    className={`consent-mode-toggle-button ${hasConsentMode ? 'enabled' : 'disabled'}`}
                    onClick={handleConsentModeToggle}
                    disabled={updatingConsentMode}
                  >
                    <span className="toggle-slider">
                      <span className="toggle-thumb"></span>
                    </span>
                    <span className="toggle-label">
                      {updatingConsentMode ? '처리중...' : (hasConsentMode ? '비활성화' : '활성화')}
                    </span>
                  </button>
                  <div className="consent-mode-info">
                    <AlertCircle size={14} />
                    <span>Consent Mode 사용 시, 사용자가 쿠키 거부하면 GA4 이벤트가 전송되지 않습니다.</span>
                  </div>
                </div>

                {/* Status Management */}
                <div className="current-status-display">
                  <span className="detail-label">현재 상태:</span>
                  <span className={`property-status-badge property-status-${propertyStatus || 'normal'}`}>
                    {propertyStatus === 'debugging' ? '디버깅중' :
                     propertyStatus === 'issue' ? '이슈' : '정상'}
                  </span>
                </div>
                <div className="status-change-buttons">
                  <button
                    className={`status-button status-normal ${propertyStatus === 'normal' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('normal')}
                    disabled={updatingStatus || propertyStatus === 'normal'}
                  >
                    정상
                  </button>
                  <button
                    className={`status-button status-issue ${propertyStatus === 'issue' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('issue')}
                    disabled={updatingStatus || propertyStatus === 'issue'}
                  >
                    이슈
                  </button>
                  <button
                    className={`status-button status-debugging ${propertyStatus === 'debugging' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('debugging')}
                    disabled={updatingStatus || propertyStatus === 'debugging'}
                  >
                    디버깅중
                  </button>
                </div>
                {result.issues?.length > 0 && (
                  <div className="status-recommendation">
                    <AlertCircle size={16} />
                    <span>
                      이 프로퍼티에 {result.issues.length}개의 이슈가 발견되었습니다.
                      상태를 "이슈" 또는 "디버깅중"으로 변경하는 것을 권장합니다.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Task 5.2: Expected vs Actual Comparison */}
          <div className="validation-comparison-section">
            <h3 className="section-title">검증 결과 비교</h3>

            {/* GA4 Validation */}
            <div className="comparison-card">
              <h4 className="comparison-title">GA4 측정 ID</h4>
              <div className="comparison-values">
                <div className="comparison-item">
                  <span className="comparison-label">기대값:</span>
                  <code className="comparison-code expected">
                    {result.ga4_validation?.expected || 'N/A'}
                  </code>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">실제값:</span>
                  <code className={`comparison-code actual ${
                    result.ga4_validation?.expected === result.ga4_validation?.actual
                      ? 'match'
                      : 'mismatch'
                  }`}>
                    {result.ga4_validation?.actual || 'N/A'}
                  </code>
                </div>
              </div>
              {result.ga4_validation?.expected === result.ga4_validation?.actual ? (
                <div className="comparison-status success">
                  <CheckCircle size={16} />
                  <span>일치</span>
                </div>
              ) : (
                <div className="comparison-status error">
                  <XCircle size={16} />
                  <span>불일치</span>
                </div>
              )}
            </div>

            {/* GTM Validation */}
            <div className="comparison-card">
              <h4 className="comparison-title">GTM 컨테이너 ID</h4>
              <div className="comparison-values">
                <div className="comparison-item">
                  <span className="comparison-label">기대값:</span>
                  <code className="comparison-code expected">
                    {result.gtm_validation?.expected || 'N/A'}
                  </code>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">실제값:</span>
                  <code className={`comparison-code actual ${
                    result.gtm_validation?.expected === result.gtm_validation?.actual
                      ? 'match'
                      : 'mismatch'
                  }`}>
                    {result.gtm_validation?.actual || 'N/A'}
                  </code>
                </div>
              </div>
              {result.gtm_validation?.expected === result.gtm_validation?.actual ? (
                <div className="comparison-status success">
                  <CheckCircle size={16} />
                  <span>일치</span>
                </div>
              ) : (
                <div className="comparison-status error">
                  <XCircle size={16} />
                  <span>불일치</span>
                </div>
              )}
            </div>
          </div>

          {/* Task 5.1: Issue Details with Descriptions */}
          {hasIssues && (
            <div className="issues-section">
              <h3 className="section-title">발견된 이슈</h3>
              <div className="issues-list">
                {result.issues.map((issue, index) => {
                  const issueInfo = getIssueTypeDescription(issue.type);
                  const guideLink = getResolutionGuide(issue.type);

                  return (
                    <div key={index} className={`issue-card severity-${issueInfo.severity}`}>
                      <div className="issue-header">
                        {getSeverityIcon(issueInfo.severity)}
                        <h4 className="issue-title">{issueInfo.title}</h4>
                      </div>
                      <p className="issue-description">{issueInfo.description}</p>
                      {issue.details && (
                        <div className="issue-details">
                          <strong>상세:</strong> {issue.details}
                        </div>
                      )}

                      {/* Task 5.4: Resolution Guide Link */}
                      <div className="issue-guide">
                        <Book size={16} />
                        <a
                          href={guideLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="guide-link"
                        >
                          해결 가이드 보기
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Task 5.3: Screenshot Section */}
          {(result.screenshot_url || result.screenshot_path) && (
            <div className="screenshot-section">
              <h3 className="section-title">스크린샷</h3>
              <div className="screenshot-preview">
                <img
                  src={result.screenshot_url || `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/${result.screenshot_path}`}
                  alt="Page screenshot"
                  className="screenshot-thumbnail"
                  onClick={handleViewScreenshot}
                />
                <button
                  className="screenshot-view-button"
                  onClick={handleViewScreenshot}
                >
                  <ImageIcon size={16} />
                  확대 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Task 5.3: Screenshot Viewer Modal */}
      {selectedScreenshot && (
        <div className="screenshot-modal-backdrop" onClick={closeScreenshotModal}>
          <div className="screenshot-modal-content">
            <button
              className="screenshot-modal-close"
              onClick={closeScreenshotModal}
              aria-label="Close"
            >
              <X size={24} />
            </button>
            <img
              src={selectedScreenshot}
              alt="Full screenshot"
              className="screenshot-full"
            />
          </div>
        </div>
      )}
    </>
  );
}

IssueDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  result: PropTypes.shape({
    id: PropTypes.string,
    property_name: PropTypes.string,
    url: PropTypes.string,
    validation_status: PropTypes.string,
    ga4_validation: PropTypes.shape({
      expected: PropTypes.string,
      actual: PropTypes.string,
    }),
    gtm_validation: PropTypes.shape({
      expected: PropTypes.string,
      actual: PropTypes.string,
    }),
    issues: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        details: PropTypes.string,
      })
    ),
    screenshot_path: PropTypes.string, // Legacy field (backward compatibility)
    screenshot_url: PropTypes.string,  // Supabase Storage public URL
  }),
};

export default IssueDetailModal;
