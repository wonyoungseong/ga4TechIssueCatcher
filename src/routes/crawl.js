/**
 * Crawl API Routes
 *
 * Manages crawl execution, status monitoring, and results retrieval.
 */

import express from 'express';
import { supabase, Tables, CrawlRunStatus } from '../utils/supabase.js';
import { runValidation, stopCrawl } from '../modules/orchestrator.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Configure dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const router = express.Router();

/**
 * Parse GTM ID from various formats (array, JSON string, or single string)
 * @param {any} gtmId - GTM ID in any format
 * @returns {Array<string>} - Array of GTM IDs
 */
function parseGTMIdArray(gtmId) {
  if (Array.isArray(gtmId)) {
    return gtmId;
  } else if (typeof gtmId === 'string') {
    // Try to parse as JSON array first
    if (gtmId.startsWith('[')) {
      try {
        return JSON.parse(gtmId);
      } catch (e) {
        // If JSON parse fails, treat as single string
        return [gtmId];
      }
    } else {
      // Single string value
      return [gtmId];
    }
  }
  return [];
}

/**
 * Normalize URL by ensuring it has a protocol (http:// or https://)
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL with protocol
 */
function normalizeUrl(url) {
  if (!url) return url;

  // Trim whitespace
  url = url.trim();

  // If URL already has protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Add https:// by default
  return `https://${url}`;
}

// Broadcast function (will be set by server.js)
let broadcastFn = null;

export function setBroadcastForCrawl(broadcast) {
  broadcastFn = broadcast;
}

// Global crawl state management - includes Phase 2 specific fields
let currentCrawlState = {
  isRunning: false,
  runId: null,
  startedAt: null,
  progress: {
    total: 0,
    completed: 0,
    failed: 0,
    current: null,
    // Phase fields
    phase: 1,
    phase1Completed: 0,
    phase2Completed: 0,
    phase2Total: 0,
    phase2Progress: 0,
    phase2ElapsedTime: 0,
    phase2MaxDuration: 0
  }
};

/**
 * GET /api/crawl/status
 * Get current crawl status
 */
router.get('/status', async (req, res) => {
  try {
    if (!currentCrawlState.isRunning) {
      // Get most recent crawl run
      const { data: latestRun, error } = await supabase
        .from(Tables.CRAWL_RUNS)
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return res.json({
        success: true,
        data: {
          isRunning: false,
          latestRun: latestRun || null
        }
      });
    }

    // Get current run details
    const { data: currentRun, error } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('*')
      .eq('id', currentCrawlState.runId)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        isRunning: true,
        currentRun,
        progress: currentCrawlState.progress
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crawl/start
 * Start a new crawl execution
 */
router.post('/start', async (req, res) => {
  try {
    // Check if crawl is disabled (for production/low-memory environments)
    if (process.env.DISABLE_CRAWL_START === 'true') {
      return res.status(403).json({
        success: false,
        error: 'Crawl execution is disabled in this environment. Please run crawls locally.',
        reason: 'CRAWL_DISABLED'
      });
    }

    // Check if crawl is already running
    if (currentCrawlState.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Crawl is already running',
        currentRunId: currentCrawlState.runId
      });
    }

    // Get configuration from request body or use defaults
    const {
      browserPoolSize = parseInt(process.env.BROWSER_POOL_SIZE) || 2,
      propertyIds = null // If null, crawl all active properties
    } = req.body;

    // Create new crawl run record
    // Use KST (Asia/Seoul) timezone for run_date and timestamps
    const now = dayjs().tz('Asia/Seoul');
    const runDate = now.format('YYYY-MM-DD');
    const startedAt = now.toISOString();

    console.log('[POST /start] Creating crawl run with KST date:', runDate, 'started_at:', startedAt);

    const { data: crawlRun, error: createError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .insert({
        run_date: runDate,
        status: CrawlRunStatus.RUNNING,
        browser_pool_size: browserPoolSize,
        started_at: startedAt
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Update global state - reset ALL fields including Phase 2 specific fields
    currentCrawlState = {
      isRunning: true,
      runId: crawlRun.id,
      startedAt: new Date(),
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        current: null,
        // Phase fields
        phase: 1,
        phase1Completed: 0,
        phase2Completed: 0,
        phase2Total: 0,
        phase2Progress: 0,
        phase2ElapsedTime: 0,
        phase2MaxDuration: 0
      }
    };

    // Start crawl in background (don't await)
    startCrawlAsync(crawlRun.id, browserPoolSize, propertyIds)
      .catch(error => {
        console.error('Crawl execution error:', error);
      });

    res.json({
      success: true,
      data: {
        runId: crawlRun.id,
        message: 'Crawl started successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crawl/runs
 * Get crawl run history with optional filtering
 * Query params:
 * - limit: number of runs to return (default: 30)
 * - offset: pagination offset (default: 0)
 * - start_date: filter runs after this date (ISO format)
 * - end_date: filter runs before this date (ISO format)
 * - status: filter by run status (running, completed, failed, cancelled)
 * - has_issues: filter by issue status ('issues', 'no-issues', 'all')
 * - search: search in property names and URLs within runs
 */
router.get('/runs', async (req, res) => {
  try {
    const {
      limit = 30,
      offset = 0,
      start_date,
      end_date,
      status,
      has_issues = 'all',
      search
    } = req.query;

    let query = supabase
      .from(Tables.CRAWL_RUNS)
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false });

    // Apply date range filters using run_date (KST-based date column)
    if (start_date) {
      query = query.gte('run_date', start_date);
    }
    if (end_date) {
      query = query.lte('run_date', end_date);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply has_issues filter using properties_with_issues column
    if (has_issues === 'issues') {
      query = query.gt('properties_with_issues', 0);
    } else if (has_issues === 'no-issues') {
      query = query.eq('properties_with_issues', 0);
    }

    // Apply search filter - this requires checking crawl_results
    if (search && search.trim()) {
      // Get run IDs that have results matching the search term
      const { data: matchingResults, error: searchError } = await supabase
        .from(Tables.CRAWL_RESULTS)
        .select(`
          crawl_run_id,
          properties (
            property_name,
            url
          )
        `);

      if (searchError) {
        throw searchError;
      }

      // Filter results by search term (case-insensitive)
      const searchLower = search.toLowerCase().trim();
      const matchingRunIds = new Set();

      matchingResults.forEach(result => {
        const propertyName = result.properties?.property_name?.toLowerCase() || '';
        const url = result.properties?.url?.toLowerCase() || '';

        if (propertyName.includes(searchLower) || url.includes(searchLower)) {
          matchingRunIds.add(result.crawl_run_id);
        }
      });

      const runIds = Array.from(matchingRunIds);

      if (runIds.length === 0) {
        // No matches - return empty result
        return res.json({
          success: true,
          data: [],
          count: 0,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: 0
          }
        });
      }

      query = query.in('id', runIds);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
      count,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crawl/runs/:runId
 * Get specific crawl run details
 */
router.get('/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    const { data: crawlRun, error: runError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('*')
      .eq('id', runId)
      .single();

    if (runError) {
      throw runError;
    }

    // Get results for this run
    const { data: results, error: resultsError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select(`
        *,
        properties (
          property_name,
          url,
          slug
        )
      `)
      .eq('crawl_run_id', runId)
      .order('created_at', { ascending: false });

    if (resultsError) {
      throw resultsError;
    }

    res.json({
      success: true,
      data: {
        run: crawlRun,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crawl/runs/:runId/results
 * Get results for a specific crawl run (separate endpoint for efficiency)
 */
router.get('/runs/:runId/results', async (req, res) => {
  try {
    const { runId } = req.params;

    // Get results for this run with expected values from properties
    const { data: results, error: resultsError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select(`
        *,
        properties (
          property_name,
          url,
          slug,
          expected_ga4_id,
          expected_gtm_id,
          current_status,
          is_active
        )
      `)
      .eq('crawl_run_id', runId)
      .order('created_at', { ascending: false });

    if (resultsError) {
      throw resultsError;
    }

    // Remove duplicates - keep only the latest result per property (highest created_at)
    const uniqueResults = [];
    const seenProperties = new Set();

    // Results are already sorted by created_at DESC, so first occurrence is most recent
    for (const result of results) {
      if (!seenProperties.has(result.property_id)) {
        uniqueResults.push(result);
        seenProperties.add(result.property_id);
      }
    }

    // Transform results to match frontend expectations
    // Frontend expects: ga4_validation and gtm_validation objects with expected/actual properties
    const transformedResults = uniqueResults.map(result => {
      const expectedGA4 = result.properties?.expected_ga4_id;
      const actualGA4 = result.collected_ga4_id;
      const expectedGTM = result.properties?.expected_gtm_id;

      // Handle GTM ID as array (can be array, JSON string, or single string)
      const collectedGTMArray = parseGTMIdArray(result.collected_gtm_id);

      // Check if expected GTM is in the collected array (case-insensitive, trimmed)
      const normalizedExpectedGTM = expectedGTM ? expectedGTM.trim().toUpperCase() : '';
      const gtmMatched = collectedGTMArray.some(gtm =>
        gtm && gtm.trim().toUpperCase() === normalizedExpectedGTM
      );

      // Actual GTM to display: matched expected value or first collected GTM
      const actualGTM = gtmMatched ? expectedGTM : (collectedGTMArray[0] || null);

      // Calculate validation status and issues
      const issues = [];

      // Check if there was a validation error (failed or error status)
      const hasValidationError = result.validation_status === 'failed' || result.validation_status === 'error';

      if (hasValidationError) {
        // Parse user-friendly error message
        let errorMessage = result.issue_summary || '검증 실패';

        // Convert technical errors to user-friendly messages
        if (errorMessage.includes('Target page, context or browser has been closed')) {
          errorMessage = '페이지 로딩 중 브라우저가 종료되었습니다';
        } else if (errorMessage.includes('page.goto')) {
          errorMessage = '페이지 접속 실패 (URL 확인 필요)';
        } else if (errorMessage.includes('DNS')) {
          errorMessage = 'DNS 오류 (도메인 확인 필요)';
        } else if (errorMessage.includes('ERR_ABORTED')) {
          errorMessage = '페이지 로딩이 중단되었습니다';
        } else if (errorMessage.includes('Timeout')) {
          errorMessage = '페이지 응답 시간 초과';
        } else if (errorMessage.includes('net::')) {
          errorMessage = '네트워크 연결 오류';
        }

        issues.push({
          type: 'VALIDATION_ERROR',
          message: errorMessage,
          details: result.issue_summary // Keep original for debugging
        });
      }

      // Extract Consent Mode and GA4 configuration issues from backend validation
      if (result.validation_details?.measurementId?.issues) {
        result.validation_details.measurementId.issues.forEach(issue => {
          if (issue.type === 'CONSENT_MODE_BASIC_DETECTED') {
            issues.push({
              type: 'consent_mode_basic_detected',  // Convert to frontend naming
              severity: 'info',
              message: 'Consent Mode로 인한 GA4 차단',
              details: issue.message,
              indicators: issue.indicators
            });
          } else if (issue.type === 'GA4_NOT_CONFIGURED') {
            issues.push({
              type: 'ga4_not_configured',
              severity: 'critical',
              message: 'GTM 컨테이너는 있지만 GA4가 설정되지 않음',
              details: issue.message,
              indicators: issue.indicators
            });
          }
        });
      }

      // Check GA4 mismatch
      if (expectedGA4 && actualGA4 && expectedGA4 !== actualGA4) {
        issues.push({
          type: 'ga4_mismatch',
          message: `GA4 ID 불일치: 기대값 ${expectedGA4}, 실제값 ${actualGA4}`
        });
      } else if (expectedGA4 && !actualGA4 && !hasValidationError) {
        let message = `GA4 ID 누락: 기대값 ${expectedGA4}`;

        // Add phase 2 detection warning
        if (result.phase === 2 && result.page_view_event_detected) {
          const detectionSeconds = (result.executionTimeMs / 1000).toFixed(1);
          message += ` (Phase 2에서 ${detectionSeconds}초 후 page_view 이벤트 확인됨. 매우 느린 로딩으로 데이터 유실 가능성 있음)`;
        }

        issues.push({
          type: 'ga4_missing',
          message: message
        });
      }

      // Check GTM mismatch - now using array logic
      if (expectedGTM && collectedGTMArray.length > 0 && !gtmMatched) {
        issues.push({
          type: 'gtm_mismatch',
          message: `GTM ID 불일치: 기대값 ${expectedGTM}, 실제값 ${collectedGTMArray.join(', ')}`
        });
      } else if (expectedGTM && collectedGTMArray.length === 0 && !hasValidationError) {
        let message = `GTM ID 누락: 기대값 ${expectedGTM}`;

        // Add phase 2 detection warning
        if (result.phase === 2 && result.page_view_event_detected) {
          const detectionSeconds = (result.executionTimeMs / 1000).toFixed(1);
          message += ` (Phase 2에서 ${detectionSeconds}초 후 page_view 이벤트 확인됨. 매우 느린 로딩으로 데이터 유실 가능성 있음)`;
        }

        issues.push({
          type: 'gtm_missing',
          message: message
        });
      }

      // Determine overall validation status
      const validation_status = issues.length === 0 ? 'success' : 'failed';

      return {
        ...result,
        // Flatten properties data to top level for frontend
        property_name: result.properties?.property_name || result.property_name,
        url: result.properties?.url || result.url,
        slug: result.properties?.slug || result.slug,
        // Add validation status and issues
        validation_status,
        status: validation_status, // Add status field for frontend compatibility
        issues,
        // Add validation objects for frontend compatibility
        ga4_validation: {
          expected: expectedGA4,
          actual: actualGA4
        },
        gtm_validation: {
          expected: expectedGTM,
          actual: actualGTM
        },
        // Also provide flat structure for backward compatibility
        detected_ga4_id: actualGA4,
        detected_gtm_id: actualGTM,
        expected_ga4_id: expectedGA4,
        expected_gtm_id: expectedGTM,
        collected_ga4_id: actualGA4,
        collected_gtm_id: actualGTM
      };
    });

    res.json({
      success: true,
      data: {
        results: transformedResults
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Async function to start crawl in background
 */
async function startCrawlAsync(runId, browserPoolSize, propertyIds) {
  try {
    // Get properties to crawl
    let query = supabase
      .from(Tables.PROPERTIES)
      .select('*')
      .eq('is_active', true);

    if (propertyIds && Array.isArray(propertyIds)) {
      query = query.in('id', propertyIds);
    }

    const { data: properties, error: propError } = await query;

    if (propError) {
      throw propError;
    }

    // Update total count
    await supabase
      .from(Tables.CRAWL_RUNS)
      .update({ total_properties: properties.length })
      .eq('id', runId);

    currentCrawlState.progress.total = properties.length;

    // Transform Supabase properties to CSV format expected by orchestrator
    const transformedProperties = properties.map(prop => ({
      propertyName: prop.property_name,
      measurementId: prop.expected_ga4_id,
      gtmContainerId: prop.expected_gtm_id,
      representativeUrl: normalizeUrl(prop.url), // Ensure URL has protocol (http:// or https://)
      brand: prop.brand,
      region: prop.region,
      slug: prop.slug, // Used by orchestrator for screenshot filenames
      hasConsentMode: prop.has_consent_mode || false, // Story 10.2: Consent Mode support
      // Keep original for reference
      _supabaseId: prop.id
    }));

    // Run validation (this will be implemented in orchestrator)
    const summary = await runValidation({
      csvPath: null, // We're using Supabase now
      browserPoolSize,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      retentionDays: parseInt(process.env.RETENTION_DAYS) || 30,
      runId, // Pass runId for Supabase integration
      properties: transformedProperties // Pass transformed properties
    });

    // Determine final status based on whether crawl was cancelled
    const finalStatus = summary.wasCancelled ? CrawlRunStatus.CANCELLED : CrawlRunStatus.COMPLETED;

    // Update crawl run with results (use KST timezone)
    const completedAt = dayjs().tz('Asia/Seoul').toISOString();
    const durationSeconds = Math.floor((new Date() - currentCrawlState.startedAt) / 1000);

    console.log('[startCrawlAsync] Updating crawl run with KST completed_at:', completedAt);

    const { data: completedRun } = await supabase
      .from(Tables.CRAWL_RUNS)
      .update({
        status: finalStatus,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        completed_properties: summary.successfulValidations || 0,  // 크롤링 성공한 수
        failed_properties: summary.errorCount || 0,  // 크롤링 실패한 수
        properties_with_issues: summary.failedValidations || 0  // GA4/GTM 이슈가 있는 수
      })
      .eq('id', runId)
      .select()
      .single();

    console.log('[startCrawlAsync] Crawl completed with status:', finalStatus);
    console.log('[startCrawlAsync] Completed run data:', completedRun);

    // Broadcast completion status via WebSocket
    if (broadcastFn && completedRun) {
      console.log('[startCrawlAsync] Broadcasting crawl completion status...');
      broadcastFn({
        type: 'crawl_status',
        data: {
          isRunning: false,
          currentRun: completedRun,
          progress: currentCrawlState.progress
        }
      });
    }

    // Reset global state - reset ALL fields including Phase 2 specific fields
    currentCrawlState = {
      isRunning: false,
      runId: null,
      startedAt: null,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        current: null,
        // Phase fields
        phase: 1,
        phase1Completed: 0,
        phase2Completed: 0,
        phase2Total: 0,
        phase2Progress: 0,
        phase2ElapsedTime: 0,
        phase2MaxDuration: 0
      }
    };

  } catch (error) {
    console.error('Crawl execution failed:', error);

    // Update run status to failed (use KST timezone)
    const failedAt = dayjs().tz('Asia/Seoul').toISOString();
    const durationSeconds = Math.floor((new Date() - currentCrawlState.startedAt) / 1000);

    await supabase
      .from(Tables.CRAWL_RUNS)
      .update({
        status: CrawlRunStatus.FAILED,
        completed_at: failedAt,
        duration_seconds: durationSeconds,
        error_message: error.message
      })
      .eq('id', runId);

    // Reset global state - reset ALL fields including Phase 2 specific fields
    currentCrawlState = {
      isRunning: false,
      runId: null,
      startedAt: null,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        current: null,
        // Phase fields
        phase: 1,
        phase1Completed: 0,
        phase2Completed: 0,
        phase2Total: 0,
        phase2Progress: 0,
        phase2ElapsedTime: 0,
        phase2MaxDuration: 0
      }
    };
  }
}

/**
 * POST /api/crawl/stop
 * Stop the current crawl
 */
router.post('/stop', async (req, res) => {
  try {
    if (!currentCrawlState.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'No crawl is currently running'
      });
    }

    // Call stop function from orchestrator (async - closes browser contexts)
    const result = await stopCrawl();

    // Update state
    currentCrawlState.isRunning = false;

    // Update Supabase run status (use KST timezone)
    if (currentCrawlState.runId) {
      const endedAt = dayjs().tz('Asia/Seoul').toISOString();
      await supabase
        .from(Tables.CRAWL_RUNS)
        .update({
          status: CrawlRunStatus.CANCELLED,
          ended_at: endedAt
        })
        .eq('id', currentCrawlState.runId);
    }

    res.json({
      success: true,
      message: 'Crawl stopped successfully',
      data: result
    });

  } catch (error) {
    console.error('Stop error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crawl/runs/:runId/save
 * Save a crawl run with memo
 */
router.post('/runs/:runId/save', async (req, res) => {
  try {
    const { runId } = req.params;
    const { memo } = req.body;

    // Validate runId exists
    const { data: existingRun, error: fetchError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('id, status')
      .eq('id', runId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Crawl run not found'
        });
      }
      throw fetchError;
    }

    // Update crawl run with save flag and memo (use KST timezone)
    const savedAt = dayjs().tz('Asia/Seoul').toISOString();
    const { data: updatedRun, error: updateError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .update({
        is_saved: true,
        memo: memo || null,
        saved_at: savedAt
      })
      .eq('id', runId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      message: 'Crawl run saved successfully',
      data: updatedRun
    });
  } catch (error) {
    console.error('Save crawl run error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crawl/saved-results
 * Get all saved crawl runs with pagination
 */
router.get('/saved-results', async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;

    const { data, error, count } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('*', { count: 'exact' })
      .eq('is_saved', true)
      .order('saved_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        results: data,
        total: count
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crawl/saved-results/:id
 * Get saved result detail by ID
 */
router.get('/saved-results/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: savedRun, error: runError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .select('*')
      .eq('id', id)
      .eq('is_saved', true)
      .single();

    if (runError) {
      if (runError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Saved result not found'
        });
      }
      throw runError;
    }

    // Get results for this run with expected values from properties
    const { data: results, error: resultsError } = await supabase
      .from(Tables.CRAWL_RESULTS)
      .select(`
        *,
        properties (
          property_name,
          url,
          slug,
          expected_ga4_id,
          expected_gtm_id
        )
      `)
      .eq('crawl_run_id', id)
      .order('created_at', { ascending: false });

    if (resultsError) {
      throw resultsError;
    }

    // Remove duplicates - keep only the latest result per property (highest created_at)
    const uniqueResults = [];
    const seenProperties = new Set();

    // Results are already sorted by created_at DESC, so first occurrence is most recent
    for (const result of results) {
      if (!seenProperties.has(result.property_id)) {
        uniqueResults.push(result);
        seenProperties.add(result.property_id);
      }
    }

    // Transform results to match frontend expectations
    const transformedResults = uniqueResults.map(result => {
      const expectedGA4 = result.properties?.expected_ga4_id;
      const actualGA4 = result.collected_ga4_id;
      const expectedGTM = result.properties?.expected_gtm_id;

      // Handle GTM ID as array (can be array, JSON string, or single string)
      const collectedGTMArray = parseGTMIdArray(result.collected_gtm_id);

      // Check if expected GTM is in the collected array (case-insensitive, trimmed)
      const normalizedExpectedGTM = expectedGTM ? expectedGTM.trim().toUpperCase() : '';
      const gtmMatched = collectedGTMArray.some(gtm =>
        gtm && gtm.trim().toUpperCase() === normalizedExpectedGTM
      );

      // Actual GTM to display: matched expected value or first collected GTM
      const actualGTM = gtmMatched ? expectedGTM : (collectedGTMArray[0] || null);

      // Calculate validation status and issues
      const issues = [];

      // Check if there was a validation error (failed or error status)
      const hasValidationError = result.validation_status === 'failed' || result.validation_status === 'error';

      if (hasValidationError) {
        // Parse user-friendly error message
        let errorMessage = result.issue_summary || '검증 실패';

        // Convert technical errors to user-friendly messages
        if (errorMessage.includes('Target page, context or browser has been closed')) {
          errorMessage = '페이지 로딩 중 브라우저가 종료되었습니다';
        } else if (errorMessage.includes('page.goto')) {
          errorMessage = '페이지 접속 실패 (URL 확인 필요)';
        } else if (errorMessage.includes('DNS')) {
          errorMessage = 'DNS 오류 (도메인 확인 필요)';
        } else if (errorMessage.includes('ERR_ABORTED')) {
          errorMessage = '페이지 로딩이 중단되었습니다';
        } else if (errorMessage.includes('Timeout')) {
          errorMessage = '페이지 응답 시간 초과';
        } else if (errorMessage.includes('net::')) {
          errorMessage = '네트워크 연결 오류';
        }

        issues.push({
          type: 'VALIDATION_ERROR',
          message: errorMessage,
          details: result.issue_summary // Keep original for debugging
        });
      }

      // Check GA4 mismatch
      if (expectedGA4 && actualGA4 && expectedGA4 !== actualGA4) {
        issues.push({
          type: 'ga4_mismatch',
          message: `GA4 ID 불일치: 기대값 ${expectedGA4}, 실제값 ${actualGA4}`
        });
      } else if (expectedGA4 && !actualGA4 && !hasValidationError) {
        let message = `GA4 ID 누락: 기대값 ${expectedGA4}`;

        // Add phase 2 detection warning
        if (result.phase === 2 && result.page_view_event_detected) {
          const detectionSeconds = (result.executionTimeMs / 1000).toFixed(1);
          message += ` (Phase 2에서 ${detectionSeconds}초 후 page_view 이벤트 확인됨. 매우 느린 로딩으로 데이터 유실 가능성 있음)`;
        }

        issues.push({
          type: 'ga4_missing',
          message: message
        });
      }

      // Check GTM mismatch - now using array logic
      if (expectedGTM && collectedGTMArray.length > 0 && !gtmMatched) {
        issues.push({
          type: 'gtm_mismatch',
          message: `GTM ID 불일치: 기대값 ${expectedGTM}, 실제값 ${collectedGTMArray.join(', ')}`
        });
      } else if (expectedGTM && collectedGTMArray.length === 0 && !hasValidationError) {
        let message = `GTM ID 누락: 기대값 ${expectedGTM}`;

        // Add phase 2 detection warning
        if (result.phase === 2 && result.page_view_event_detected) {
          const detectionSeconds = (result.executionTimeMs / 1000).toFixed(1);
          message += ` (Phase 2에서 ${detectionSeconds}초 후 page_view 이벤트 확인됨. 매우 느린 로딩으로 데이터 유실 가능성 있음)`;
        }

        issues.push({
          type: 'gtm_missing',
          message: message
        });
      }

      // Determine overall validation status
      const validation_status = issues.length === 0 ? 'success' : 'failed';

      return {
        ...result,
        // Flatten properties data to top level for frontend
        property_name: result.properties?.property_name || result.property_name,
        url: result.properties?.url || result.url,
        slug: result.properties?.slug || result.slug,
        // Add validation status and issues
        validation_status,
        status: validation_status, // Add status field for frontend compatibility
        issues,
        // Add validation objects for frontend compatibility
        ga4_validation: {
          expected: expectedGA4,
          actual: actualGA4
        },
        gtm_validation: {
          expected: expectedGTM,
          actual: actualGTM
        },
        // Also provide flat structure for backward compatibility
        detected_ga4_id: actualGA4,
        detected_gtm_id: actualGTM,
        expected_ga4_id: expectedGA4,
        expected_gtm_id: expectedGTM,
        collected_ga4_id: actualGA4,
        collected_gtm_id: actualGTM
      };
    });

    // Get all active properties to fill in missing ones
    const { data: allProperties, error: propsError } = await supabase
      .from(Tables.PROPERTIES)
      .select('id, property_name, url, slug, expected_ga4_id, expected_gtm_id')
      .eq('is_active', true)
      .order('property_name', { ascending: true });

    if (propsError) {
      throw propsError;
    }

    // Create a map of property_id -> result for quick lookup
    const resultMap = new Map();
    transformedResults.forEach(result => {
      resultMap.set(result.property_id, result);
    });

    // Build complete results array: validated properties + missing properties
    const completeResults = allProperties.map(property => {
      const existingResult = resultMap.get(property.id);

      if (existingResult) {
        // Property was validated - return existing result
        return existingResult;
      } else {
        // Property was NOT validated - create placeholder result
        return {
          id: `missing_${property.id}`,
          property_id: property.id,
          property_name: property.property_name,
          url: property.url,
          slug: property.slug,
          validation_status: 'not_validated',
          status: 'not_validated',
          issues: [{
            type: 'NOT_VALIDATED',
            message: '이 프로퍼티는 검증되지 않았습니다'
          }],
          ga4_validation: {
            expected: property.expected_ga4_id,
            actual: null
          },
          gtm_validation: {
            expected: property.expected_gtm_id,
            actual: null
          },
          expected_ga4_id: property.expected_ga4_id,
          expected_gtm_id: property.expected_gtm_id,
          collected_ga4_id: null,
          collected_gtm_id: null,
          screenshot_path: null,
          screenshot_url: null,
          created_at: savedRun.started_at,
          crawl_run_id: id
        };
      }
    });

    res.json({
      success: true,
      data: {
        ...savedRun,
        results: completeResults,
        total_active_properties: allProperties.length,
        validated_properties: transformedResults.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/crawl/saved-results/:id
 * Update saved result (e.g., memo)
 */
router.put('/saved-results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { memo } = req.body;

    const { data: updatedRun, error } = await supabase
      .from(Tables.CRAWL_RUNS)
      .update({ memo })
      .eq('id', id)
      .eq('is_saved', true)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Saved result not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: updatedRun
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/crawl/saved-results/:id
 * Delete saved result by ID
 */
router.delete('/saved-results/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Instead of deleting, just unmark as saved
    const { data: updatedRun, error } = await supabase
      .from(Tables.CRAWL_RUNS)
      .update({
        is_saved: false,
        memo: null,
        saved_at: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Saved result not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Saved result removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Export state getter for WebSocket updates
 */
export function getCrawlState() {
  return currentCrawlState;
}

/**
 * Export state setter for orchestrator updates
 */
export function updateCrawlProgress(progress) {
  currentCrawlState.progress = {
    ...currentCrawlState.progress,
    ...progress
  };
}

export default router;
