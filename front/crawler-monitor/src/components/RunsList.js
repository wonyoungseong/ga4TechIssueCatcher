/**
 * RunsList Component - Story 9.4 Task 1.2
 *
 * Displays a list of crawl runs in card format.
 */

import React from 'react';
import PropTypes from 'prop-types';
import RunCard from './RunCard';
import EmptyState from './EmptyState';

function RunsList({ runs, selectedRun, onSelectRun }) {
  // Empty state
  if (!runs || runs.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="크롤링 실행 기록이 없습니다"
        description="크롤링을 실행하면 여기에 결과가 표시됩니다"
      />
    );
  }

  return (
    <div className="runs-list">
      {runs.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          isSelected={selectedRun && selectedRun.id === run.id}
          onClick={() => onSelectRun(run)}
        />
      ))}
    </div>
  );
}

RunsList.propTypes = {
  runs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      run_date: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      total_properties: PropTypes.number,
      completed_properties: PropTypes.number,
      failed_properties: PropTypes.number,
      properties_with_issues: PropTypes.number,
      duration_seconds: PropTypes.number,
    })
  ).isRequired,
  selectedRun: PropTypes.object,
  onSelectRun: PropTypes.func.isRequired,
};

export default RunsList;
