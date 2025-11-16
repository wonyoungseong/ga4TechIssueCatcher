import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import './CompareView.css';

/**
 * CompareView Component
 *
 * Displays a side-by-side comparison of two saved results
 * Shows new issues, resolved issues, and status changes
 *
 * Props:
 * - result1: object - First saved result (older)
 * - result2: object - Second saved result (newer)
 * - onClose: function - Callback to close compare view
 */
const CompareView = ({ result1, result2, onClose }) => {
  // Compare results and calculate changes
  const comparisonData = useMemo(() => {
    if (!result1 || !result2) return null;

    const changes = {
      newIssues: [],
      resolvedIssues: [],
      statusChanges: [],
      summary: {
        totalChanges: 0,
        improved: 0,
        degraded: 0,
        unchanged: 0
      }
    };

    // Get all property IDs from both results
    const allPropertyIds = new Set([
      ...(result1.results || []).map(r => r.property_id),
      ...(result2.results || []).map(r => r.property_id)
    ]);

    allPropertyIds.forEach((propertyId) => {
      const r1 = (result1.results || []).find(r => r.property_id === propertyId);
      const r2 = (result2.results || []).find(r => r.property_id === propertyId);

      if (!r1 || !r2) return;

      const r1Issues = r1.issues || [];
      const r2Issues = r2.issues || [];

      // Find new issues (in r2 but not in r1)
      r2Issues.forEach((issue) => {
        const issueKey = `${issue.type}-${issue.expected || ''}-${issue.actual || ''}`;
        const existsInR1 = r1Issues.some(i => {
          const key = `${i.type}-${i.expected || ''}-${i.actual || ''}`;
          return key === issueKey;
        });

        if (!existsInR1) {
          changes.newIssues.push({
            property: r2.property_name,
            issue: issue
          });
        }
      });

      // Find resolved issues (in r1 but not in r2)
      r1Issues.forEach((issue) => {
        const issueKey = `${issue.type}-${issue.expected || ''}-${issue.actual || ''}`;
        const existsInR2 = r2Issues.some(i => {
          const key = `${i.type}-${i.expected || ''}-${i.actual || ''}`;
          return key === issueKey;
        });

        if (!existsInR2) {
          changes.resolvedIssues.push({
            property: r1.property_name,
            issue: issue
          });
        }
      });

      // Check status changes
      if (r1.status !== r2.status) {
        changes.statusChanges.push({
          property: r1.property_name,
          from: r1.status,
          to: r2.status
        });
      }
    });

    // Calculate summary
    changes.summary.totalChanges =
      changes.newIssues.length +
      changes.resolvedIssues.length +
      changes.statusChanges.length;

    changes.summary.improved = changes.resolvedIssues.length;
    changes.summary.degraded = changes.newIssues.length;
    changes.summary.unchanged =
      allPropertyIds.size -
      new Set([
        ...changes.newIssues.map(i => i.property),
        ...changes.resolvedIssues.map(i => i.property),
        ...changes.statusChanges.map(i => i.property)
      ]).size;

    return changes;
  }, [result1, result2]);

  if (!comparisonData) {
    return null;
  }

  return (
    <div className="compare-view">
      <div className="compare-header">
        <h2>결과 비교</h2>
        <button className="close-btn" onClick={onClose} title="비교 종료">
          <X size={20} />
          닫기
        </button>
      </div>

      <div className="compare-dates">
        <div className="compare-date-item older">
          <span className="date-label">이전</span>
          <span className="date-value">
            {formatDate(result1.original_run_date, 'YYYY-MM-DD')}
          </span>
        </div>
        <div className="compare-arrow">→</div>
        <div className="compare-date-item newer">
          <span className="date-label">최신</span>
          <span className="date-value">
            {formatDate(result2.original_run_date, 'YYYY-MM-DD')}
          </span>
        </div>
      </div>

      <div className="compare-summary">
        <div className="summary-card improved">
          <TrendingUp size={24} className="summary-icon" />
          <div className="summary-content">
            <div className="summary-count">{comparisonData.summary.improved}</div>
            <p className="summary-label">개선됨</p>
            <p className="summary-desc">해결된 이슈</p>
          </div>
        </div>

        <div className="summary-card degraded">
          <TrendingDown size={24} className="summary-icon" />
          <div className="summary-content">
            <div className="summary-count">{comparisonData.summary.degraded}</div>
            <p className="summary-label">악화됨</p>
            <p className="summary-desc">새로운 이슈</p>
          </div>
        </div>

        <div className="summary-card unchanged">
          <Minus size={24} className="summary-icon" />
          <div className="summary-content">
            <div className="summary-count">{comparisonData.summary.unchanged}</div>
            <p className="summary-label">변화 없음</p>
            <p className="summary-desc">프로퍼티</p>
          </div>
        </div>
      </div>

      <div className="changes-details">
        {comparisonData.resolvedIssues.length > 0 && (
          <div className="changes-section improved">
            <h3>
              <TrendingUp size={20} />
              해결된 이슈 ({comparisonData.resolvedIssues.length})
            </h3>
            <ul className="changes-list">
              {comparisonData.resolvedIssues.map((item, index) => (
                <li key={index} className="change-item">
                  <span className="property-name">{item.property}</span>
                  <span className="issue-type">{item.issue.type}</span>
                  {item.issue.expected && (
                    <span className="issue-detail">
                      Expected: {item.issue.expected}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonData.newIssues.length > 0 && (
          <div className="changes-section degraded">
            <h3>
              <TrendingDown size={20} />
              새로운 이슈 ({comparisonData.newIssues.length})
            </h3>
            <ul className="changes-list">
              {comparisonData.newIssues.map((item, index) => (
                <li key={index} className="change-item">
                  <span className="property-name">{item.property}</span>
                  <span className="issue-type">{item.issue.type}</span>
                  {item.issue.expected && (
                    <span className="issue-detail">
                      Expected: {item.issue.expected}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonData.statusChanges.length > 0 && (
          <div className="changes-section status">
            <h3>
              상태 변경 ({comparisonData.statusChanges.length})
            </h3>
            <ul className="changes-list">
              {comparisonData.statusChanges.map((item, index) => (
                <li key={index} className="change-item">
                  <span className="property-name">{item.property}</span>
                  <span className="status-change">
                    {item.from} → {item.to}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {comparisonData.summary.totalChanges === 0 && (
          <div className="no-changes">
            <Minus size={48} className="no-changes-icon" />
            <p className="no-changes-text">두 결과 간 차이가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareView;
