import React from 'react';
import { Database, CheckCircle, XCircle } from 'lucide-react';
import './ProgressOverview.css';

/**
 * ProgressOverview Component
 *
 * Displays crawling progress statistics and progress bar
 *
 * Props:
 * - progress: object - { total, completed, failed }
 */
const ProgressOverview = ({ progress }) => {
  if (!progress) return null;

  const {
    total = 0,
    failed = 0,
    phase = 1,
    phase1Completed = 0,
    phase1Processed = 0, // All processed in Phase 1 (success + timeout) for progress bar
    phase2Completed = 0,
    phase2Total = 0,
    phase2Progress = 0, // 백엔드에서 계산한 가중치 기반 Phase 2 진행률 (0-20, Story 10.1: 70% 완료 + 30% 시간)
    phase2ElapsedTime = 0,
    phase2MaxDuration = 0
  } = progress;

  // Phase별 진행률 계산
  let progressPercentage = 0;
  let phaseText = '';

  if (phase === 1) {
    // Phase 1: 0-70% 범위
    // phase1Processed는 모든 처리된 property를 포함 (성공 + 타임아웃)
    progressPercentage = total > 0 ? Math.min(Math.round((phase1Processed / total) * 70), 70) : 0;
    phaseText = 'Phase 1: 빠른 검증';
  } else if (phase === 2) {
    // Phase 2: 70-100% 범위 (백엔드에서 계산한 시간 기반 진행률 사용)
    // Phase 1은 항상 정확히 70% (Phase 1 완료)
    const phase1Progress = 70;
    // 백엔드에서 계산한 phase2Progress 사용 (시간 기반, 0-30 범위)
    const phase2ProgressPercent = Math.round(phase2Progress);
    progressPercentage = Math.min(phase1Progress + phase2ProgressPercent, 100);

    // Phase 2 텍스트에 시간 정보 추가
    const timeInfo = phase2MaxDuration > 0
      ? ` • ${phase2ElapsedTime}s / ${phase2MaxDuration}s`
      : '';
    phaseText = `Phase 2: 느린 사이트 재검증 (${phase2Completed}/${phase2Total})${timeInfo}`;
  }

  return (
    <div className="progress-overview">
      <div className="progress-stats">
        <div className="stat-item stat-total">
          <Database size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">전체</span>
            <span className="stat-value">{total}</span>
          </div>
        </div>

        <div className="stat-item stat-completed">
          <CheckCircle size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">완료</span>
            <span className="stat-value">{phase1Completed + phase2Completed}</span>
          </div>
        </div>

        <div className="stat-item stat-failed">
          <XCircle size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">실패</span>
            <span className="stat-value">{failed}</span>
          </div>
        </div>
      </div>

      {phase && (
        <div className="phase-indicator">
          <span className="phase-text">{phaseText}</span>
        </div>
      )}

      <div className="progress-bar-container">
        <div
          className={`progress-bar-fill ${phase === 2 ? 'phase-2' : ''}`}
          style={{ width: `${progressPercentage}%` }}
        >
          <span className="progress-text">{progressPercentage}%</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressOverview;
