/**
 * ExportButton Component - Story 9.4 Task 4
 *
 * Provides CSV export functionality for crawl run results.
 * - Export filtered or all results
 * - Download progress with Toast notifications
 * - File naming with timestamp
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Download, ChevronDown } from 'lucide-react';
import { downloadCSV } from '../utils/dataUtils';
import { showToast } from '../utils/toast';
import './ExportButton.css';

function ExportButton({ results, allResults, runId, disabled = false }) {
  const [showMenu, setShowMenu] = useState(false);

  /**
   * Format results for CSV export
   */
  const formatResultsForExport = (data) => {
    return data.map(result => ({
      'Property Name': result.property_name || '',
      'URL': result.url || '',
      'Status': result.validation_status || '',
      'GA4 Expected': result.ga4_validation?.expected || '',
      'GA4 Actual': result.ga4_validation?.actual || '',
      'GA4 Match': result.ga4_validation?.expected === result.ga4_validation?.actual ? 'Yes' : 'No',
      'GTM Expected': result.gtm_validation?.expected || '',
      'GTM Actual': result.gtm_validation?.actual || '',
      'GTM Match': result.gtm_validation?.expected === result.gtm_validation?.actual ? 'Yes' : 'No',
      'Issues Count': (result.issues || []).length,
      'Screenshot URL': result.screenshot_url || '',
    }));
  };

  /**
   * Handle CSV export
   */
  const handleExport = (exportAll = false) => {
    try {
      const dataToExport = exportAll ? allResults : results;

      if (!dataToExport || dataToExport.length === 0) {
        showToast('내보낼 결과가 없습니다', 'warning');
        return;
      }

      // Format data for export
      const formattedData = formatResultsForExport(dataToExport);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `crawl-results-${runId || 'export'}-${timestamp}`;

      // Download CSV
      downloadCSV(formattedData, filename);

      // Show success message
      const count = dataToExport.length;
      const type = exportAll ? '전체' : '필터링된';
      showToast(`${type} 결과 ${count}개가 내보내기되었습니다`, 'success');

      // Close menu
      setShowMenu(false);
    } catch (error) {
      console.error('[ExportButton] Export failed:', error);
      showToast('CSV 내보내기에 실패했습니다', 'error');
    }
  };

  /**
   * Toggle export menu
   */
  const toggleMenu = () => {
    if (disabled) return;
    setShowMenu(!showMenu);
  };

  /**
   * Close menu when clicking outside
   */
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.export-button-container')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const hasFilteredResults = results && results.length > 0;
  const hasAllResults = allResults && allResults.length > 0;
  const isDifferent = hasFilteredResults && hasAllResults && results.length !== allResults.length;

  return (
    <div className="export-button-container">
      <button
        className={`export-button ${disabled ? 'disabled' : ''}`}
        onClick={toggleMenu}
        disabled={disabled || !hasFilteredResults}
        title="CSV로 내보내기"
      >
        <Download size={18} />
        <span>내보내기</span>
        {isDifferent && <ChevronDown size={16} />}
      </button>

      {showMenu && isDifferent && (
        <div className="export-menu">
          <button
            className="export-menu-item"
            onClick={() => handleExport(false)}
          >
            <span className="menu-item-label">필터링된 결과</span>
            <span className="menu-item-count">({results.length}개)</span>
          </button>
          <button
            className="export-menu-item"
            onClick={() => handleExport(true)}
          >
            <span className="menu-item-label">전체 결과</span>
            <span className="menu-item-count">({allResults.length}개)</span>
          </button>
        </div>
      )}

      {showMenu && !isDifferent && hasFilteredResults && (
        <div className="export-menu">
          <button
            className="export-menu-item"
            onClick={() => handleExport(false)}
          >
            <span className="menu-item-label">결과 내보내기</span>
            <span className="menu-item-count">({results.length}개)</span>
          </button>
        </div>
      )}
    </div>
  );
}

ExportButton.propTypes = {
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  allResults: PropTypes.arrayOf(PropTypes.object),
  runId: PropTypes.string,
  disabled: PropTypes.bool,
};

export default ExportButton;
