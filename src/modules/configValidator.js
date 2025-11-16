/**
 * Configuration Validator Module
 *
 * Validates GA4/GTM configuration against expected values.
 * Generates validation results with detailed issue reports.
 *
 * Epic 3: GA4/GTM Configuration Validation
 */

import {
  extractMeasurementId,
  extractGTMId,
  extractAllMeasurementIds,
  extractMeasurementIdsWithSource,
  extractAllGTMIds,
  findMeasurementId,
  findGTMId,
  findPageViewEvent,
  detectConsentModeBasic
} from './networkEventCapturer.js';

/**
 * Extract AP_DATA from page (window.AP_DATA or dataLayer)
 * Story 3.5: AP_DATA Environment Variable Extraction
 *
 * @param {Page} page - Playwright page instance
 * @returns {Promise<Object|null>} AP_DATA object or null
 */
export async function extractAPData(page) {
  try {
    // Try to extract from window.AP_DATA (AC1)
    const apData = await page.evaluate(() => {
      return window.AP_DATA || null;
    });

    if (apData) {
      return apData;
    }

    // Try to extract from data layer (AC2)
    const dataLayerAP = await page.evaluate(() => {
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        for (const item of window.dataLayer) {
          if (item.AP_DATA) {
            return item.AP_DATA;
          }
        }
      }
      return null;
    });

    if (dataLayerAP) {
      return dataLayerAP;
    }

    // AP_DATA not found - log warning but don't fail (AC4)
    console.warn('  ⚠️ AP_DATA not found on page');
    return null;

  } catch (error) {
    // AC5: Extraction failure should not stop validation
    console.error('  ❌ Failed to extract AP_DATA:', error.message);
    return null;
  }
}

/**
 * Validate GTM container ID from page HTML content
 * Story 3.3: GTM Container ID Validation
 *
 * Alternative validation method that scans HTML for GTM script tags.
 * Can be used as a fallback when network event capture fails.
 *
 * @param {Page} page - Playwright page instance
 * @param {string} expectedGtmId - Expected GTM container ID from CSV
 * @returns {Promise<Object>} Validation result {isValid, actualId, issues}
 */
export async function validateGTMIdFromHTML(page, expectedGtmId) {
  const issues = [];

  // AC1: Get page HTML content
  const htmlContent = await page.content();

  // AC2: Search for GTM script tags using regex
  const gtmPattern = /GTM-[A-Z0-9]{6,}/g;
  const matches = htmlContent.match(gtmPattern);

  // AC5: No GTM script found
  if (!matches || matches.length === 0) {
    issues.push({
      type: 'GTM_NOT_FOUND',
      severity: 'critical',
      message: 'No GTM script detected on page',
      expected: expectedGtmId,
      actual: null,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId: null, issues };
  }

  // AC3: Compare extracted GTM ID with expected ID
  const actualId = matches[0]; // Use first match

  // AC4: GTM ID mismatch
  if (actualId !== expectedGtmId) {
    issues.push({
      type: 'GTM_ID_MISMATCH',
      severity: 'critical',
      message: `GTM container ID mismatch`,
      expected: expectedGtmId,
      actual: actualId,
      timestamp: new Date().toISOString()
    });
    return { isValid: false, actualId, issues };
  }

  // AC6: Validation passed
  return { isValid: true, actualId, issues: [] };
}

/**
 * Issue severity levels
 */
export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Issue types
 */
export const ISSUE_TYPE = {
  MEASUREMENT_ID_MISMATCH: 'MEASUREMENT_ID_MISMATCH',
  GTM_ID_MISMATCH: 'GTM_ID_MISMATCH',
  PAGE_VIEW_NOT_FOUND: 'PAGE_VIEW_NOT_FOUND',
  NO_GA4_EVENTS: 'NO_GA4_EVENTS',
  AP_DATA_MISSING: 'AP_DATA_MISSING',
  AP_DATA_INVALID: 'AP_DATA_INVALID',
  GTM_NOT_FOUND: 'GTM_NOT_FOUND',
  SERVICE_CLOSED: 'SERVICE_CLOSED',        // Service has been closed or discontinued
  SERVER_ERROR: 'SERVER_ERROR',            // Server error (5xx) or gateway issues
  VALIDATION_ERROR: 'VALIDATION_ERROR',    // General validation errors
  CONSENT_MODE_BASIC_DETECTED: 'CONSENT_MODE_BASIC_DETECTED', // Consent Mode Basic blocking GA4
  GA4_NOT_CONFIGURED: 'GA4_NOT_CONFIGURED' // GA4 not configured in GTM (not Consent Mode)
};

/**
 * Validate property configuration
 *
 * @param {Property} property - Property to validate
 * @param {Array<NetworkEvent>} events - Captured network events
 * @param {string} url - Validated URL
 * @param {Page} page - Playwright page instance (for AP_DATA extraction)
 * @param {Object} timing - Event detection timing info
 * @param {Object} context - Additional validation context (for Consent Mode Basic detection)
 * @returns {Promise<ValidationResult>} Validation result with issues
 */
export async function validateProperty(property, events, url, page, timing = {}, context = {}) {
  const startTime = Date.now();
  const issues = [];

  console.log(`🔍 Validating ${property.propertyName}...`);

  // Validate Measurement ID (Story 11.2: Pass context for Consent Mode Basic detection)
  const measIdResult = validateMeasurementId(property, events, context);
  if (!measIdResult.isValid) {
    issues.push(...measIdResult.issues);
  }

  // Validate GTM ID
  const gtmIdResult = validateGTMId(property, events);
  if (!gtmIdResult.isValid) {
    issues.push(...gtmIdResult.issues);
  }

  // Story 11.2: Skip page_view validation when Consent Mode Basic is detected
  // Check if Consent Mode Basic was detected in measurement ID validation
  const hasConsentModeBasic = measIdResult.extractionSource?.consentMode?.type === 'basic';

  // Validate page_view event with timing information (skip if Consent Mode Basic)
  const pageViewResult = hasConsentModeBasic
    ? { isValid: true, count: 0, issues: [], skipped: 'Consent Mode Basic detected' }
    : validatePageViewEvent(events, timing);

  if (!pageViewResult.isValid) {
    issues.push(...pageViewResult.issues);
  }

  // Extract and store AP_DATA (optional, non-blocking)
  // Story 3.5: AC4 - Don't create issues if missing
  const apDataResult = await validateAPData(page);
  // Don't add issues to validation - AP_DATA is informational only

  const executionTimeMs = Date.now() - startTime;

  const result = {
    propertyName: property.propertyName,
    accountName: property.accountName,
    slug: property.slug,
    validationTime: new Date().toISOString(),
    url,
    measurementId: measIdResult,
    gtmId: gtmIdResult,
    pageViewEvent: pageViewResult,
    apData: apDataResult,
    issues,
    isValid: issues.length === 0,
    executionTimeMs
  };

  if (result.isValid) {
    console.log(`  ✅ Validation passed`);
  } else {
    console.log(`  ❌ Validation failed: ${issues.length} issue(s) found`);
    issues.forEach(issue => {
      console.log(`    • ${issue.type}: ${issue.message}`);
    });
  }

  return result;
}

/**
 * Validate measurement ID matches expected value (supports multiple GA4)
 * Story 3.2, 10.2, and 11.2: Measurement ID Validation with Consent Mode support
 *
 * @param {Property} property - Property configuration
 * @param {Array<NetworkEvent>} events - Captured events
 * @param {Object} context - Additional context for validation (optional)
 * @param {boolean} context.hasGTM - Whether GTM container is loaded
 * @param {boolean} context.hasGA4InWindow - Whether GA4 ID exists as window.google_tag_manager key
 * @returns {Object} Validation result
 */
export function validateMeasurementId(property, events, context = {}) {
  const expected = property.measurementId;
  const result = findMeasurementId(events, expected);

  // Story 11.1 Phase 3: Extract source metrics
  const sourceMetrics = extractMeasurementIdsWithSource(events);

  // No GA4 events detected
  if (result.allIds.length === 0) {
    // Story 11.2: Check for Consent Mode Basic scenario
    // Only check if property is known to use Consent Mode
    if (context.hasGTM !== undefined && context.hasGA4InWindow !== undefined && property.hasConsentMode === true) {
      const consentModeResult = detectConsentModeBasic({
        hasGTM: context.hasGTM,
        hasGA4InWindow: context.hasGA4InWindow,
        networkEvents: events,
        expectedGA4Id: expected,
        propertyHasConsentMode: property.hasConsentMode
      });

      if (consentModeResult.isConsentModeBasic) {
        return {
          isValid: true, // Valid because GA4 is configured but blocked
          expected,
          actual: null,
          allFound: [],
          extractionSource: {
            ...sourceMetrics,
            consentMode: {
              type: 'basic',
              status: 'blocking_all_data',
              confidence: consentModeResult.confidence
            }
          },
          issues: [{
            type: ISSUE_TYPE.CONSENT_MODE_BASIC_DETECTED,
            severity: SEVERITY.INFO,
            message: consentModeResult.message || 'GA4 configured in GTM but blocked by Consent Mode Basic',
            expected,
            actual: null,
            indicators: consentModeResult.indicators
          }]
        };
      }
    }

    // GTM present but GA4 not configured (not Consent Mode scenario)
    if (context.hasGTM && !context.hasGA4InWindow && property.hasConsentMode !== true) {
      return {
        isValid: false,
        expected,
        actual: null,
        allFound: [],
        extractionSource: sourceMetrics,
        issues: [{
          type: ISSUE_TYPE.GA4_NOT_CONFIGURED,
          severity: SEVERITY.CRITICAL,
          message: 'GTM container found but GA4 not configured',
          expected,
          actual: null,
          indicators: ['GTM present', 'GA4 not in window', 'No GA4 network events', 'Property does not use Consent Mode']
        }]
      };
    }

    // Story 10.2: Consent Mode Support (Advanced mode)
    // If property uses Consent Mode, no GA4 events is expected behavior (user declined consent)
    if (property.hasConsentMode === true) {
      return {
        isValid: true,
        expected,
        actual: null,
        allFound: [],
        extractionSource: sourceMetrics, // Phase 3: Add extraction source tracking
        issues: [{
          type: ISSUE_TYPE.NO_GA4_EVENTS,
          severity: SEVERITY.INFO,
          message: 'No GA4 events detected (expected with Consent Mode when user declines consent)',
          expected,
          actual: null
        }]
      };
    }

    return {
      isValid: false,
      expected,
      actual: null,
      allFound: [],
      extractionSource: sourceMetrics, // Phase 3: Add extraction source tracking
      issues: [{
        type: ISSUE_TYPE.NO_GA4_EVENTS,
        severity: SEVERITY.CRITICAL,
        message: 'No GA4 events detected',
        expected,
        actual: null
      }]
    };
  }

  // Expected GA4 found (success even if multiple GA4 exist)
  if (result.found) {
    return {
      isValid: true,
      expected,
      actual: expected,
      allFound: result.allIds,
      extractionSource: sourceMetrics, // Phase 3: Add extraction source tracking
      issues: []
    };
  }

  // Expected GA4 not found (other GA4 detected)
  return {
    isValid: false,
    expected,
    actual: result.primaryId,
    allFound: result.allIds,
    extractionSource: sourceMetrics, // Phase 3: Add extraction source tracking
    issues: [{
      type: ISSUE_TYPE.MEASUREMENT_ID_MISMATCH,
      severity: SEVERITY.CRITICAL,
      message: `Expected GA4 not found. Found: ${result.allIds.join(', ')}`,
      expected,
      actual: result.primaryId
    }]
  };
}

/**
 * Validate GTM container ID matches expected value (supports multiple GTM)
 *
 * @param {Property} property - Property configuration
 * @param {Array<NetworkEvent>} events - Captured events
 * @returns {Object} Validation result
 */
function validateGTMId(property, events) {
  const expected = property.webGtmId;

  // GTM ID is optional, skip if not configured
  if (!expected || expected === '-') {
    const allIds = extractAllGTMIds(events);
    return {
      isValid: true,
      expected: null,
      actual: allIds[0] || null,
      allFound: allIds,
      issues: []
    };
  }

  const result = findGTMId(events, expected);

  // No GTM loaded
  if (result.allIds.length === 0) {
    return {
      isValid: false,
      expected,
      actual: null,
      allFound: [],
      issues: [{
        type: ISSUE_TYPE.GTM_ID_MISMATCH,
        severity: SEVERITY.CRITICAL,
        message: 'GTM container not loaded',
        expected,
        actual: null
      }]
    };
  }

  // Expected GTM found (success even if multiple GTM exist)
  if (result.found) {
    return {
      isValid: true,
      expected,
      actual: expected,
      allFound: result.allIds,
      issues: []
    };
  }

  // Expected GTM not found (other GTM detected)
  return {
    isValid: false,
    expected,
    actual: result.primaryId,
    allFound: result.allIds,
    issues: [{
      type: ISSUE_TYPE.GTM_ID_MISMATCH,
      severity: SEVERITY.CRITICAL,
      message: `Expected GTM not found. Found: ${result.allIds.join(', ')}`,
      expected,
      actual: result.primaryId
    }]
  };
}

/**
 * Validate page_view event was captured
 *
 * @param {Array<NetworkEvent>} events - Captured events
 * @param {Object} timing - Event detection timing info { detectionTimeMs, timedOut }
 * @returns {Object} Validation result with count and timing
 */
export function validatePageViewEvent(events, timing = {}) {
  // Filter for all page_view events
  const pageViewEvents = events.filter(e =>
    e.type === 'ga4_collect' &&
    e.params.en === 'page_view'
  );

  const count = pageViewEvents.length;

  if (count === 0) {
    return {
      isValid: false,
      count: 0,
      detectionTimeMs: timing.detectionTimeMs || null,
      timedOut: timing.timedOut || false,
      issues: [{
        type: ISSUE_TYPE.PAGE_VIEW_NOT_FOUND,
        severity: SEVERITY.CRITICAL,
        message: 'No page_view event detected',
        expected: 'page_view event',
        actual: '0 events found'
      }]
    };
  }

  return {
    isValid: true,
    count,
    detectionTimeMs: timing.detectionTimeMs || null,
    timedOut: timing.timedOut || false,
    issues: []
  };
}

/**
 * Extract and store AP_DATA (non-critical)
 * Story 3.5: AC4 - Don't create issues if missing
 *
 * @param {Page} page - Playwright page instance (optional - if not provided, skips extraction)
 * @returns {Promise<Object>} AP_DATA result (always returns success, data optional)
 */
async function validateAPData(page) {
  // Skip AP_DATA extraction if page is not available (e.g., in test scenarios)
  if (!page) {
    return {
      isValid: true,
      found: false,
      data: null,
      issues: []
    };
  }

  const apData = await extractAPData(page);

  // AC3: Store AP_DATA in results if found
  // AC4: Don't create issues if missing - this is informational only
  if (!apData) {
    return {
      isValid: true, // Don't fail validation
      found: false,
      data: null,
      issues: [] // No issues created
    };
  }

  return {
    isValid: true, // Always valid - this is optional data
    found: true,
    data: apData,
    issues: [] // No issues even if structure is incomplete
  };
}

/**
 * Generate issue summary for reporting
 *
 * @param {Array<ValidationResult>} results - Validation results
 * @returns {Object} Issue summary
 */
export function generateIssueSummary(results) {
  const totalProperties = results.length;
  const validProperties = results.filter(r => r.isValid).length;
  const invalidProperties = totalProperties - validProperties;

  const issuesByType = {};
  const issuesBySeverity = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.WARNING]: 0,
    [SEVERITY.INFO]: 0
  };

  results.forEach(result => {
    // Check if result.issues exists (some results may not have issues property)
    const issues = result.issues || [];
    issues.forEach(issue => {
      // Count by type
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;

      // Count by severity
      issuesBySeverity[issue.severity]++;
    });
  });

  return {
    totalProperties,
    validProperties,
    invalidProperties,
    validationRate: ((validProperties / totalProperties) * 100).toFixed(1),
    issuesByType,
    issuesBySeverity
  };
}

export default {
  validateProperty,
  validateMeasurementId,
  validateGTMIdFromHTML,
  validatePageViewEvent,
  extractAPData,
  generateIssueSummary,
  SEVERITY,
  ISSUE_TYPE
};
