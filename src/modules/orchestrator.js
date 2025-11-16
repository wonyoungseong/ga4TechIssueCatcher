/**
 * Orchestrator Module
 *
 * Coordinates the entire validation workflow.
 * Manages browser pool, property validation, result storage, and error handling.
 *
 * Main Workflow Coordination
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.2: Parallel Browser Execution
 */

import {
  loadPropertiesFromCSV,
  detectPropertyChanges,
  loadPreviousProperties,
  savePreviousProperties
} from './csvPropertyManager.js';
import { BrowserPool, createStealthPage, processInParallel } from './browserPoolManager.js';
import { startCapturing, waitForGA4Events, waitForGTMLoad, detectConsentMode } from './networkEventCapturer.js';
import { validateProperty, generateIssueSummary } from './configValidator.js';
import {
  saveValidationResult,
  saveScreenshot,
  cleanupOldFiles,
  saveSummary
} from './resultStorage.js';
import logger from '../utils/logger.js';
import { supabase, Tables } from '../utils/supabase.js';
import { updateCrawlProgress, getCrawlState } from '../routes/crawl.js';
import { getTempCache } from './tempCacheManager.js';
import BatchUploadManager from './batchUploadManager.js';

// WebSocket broadcast function (set by server after initialization)
let broadcast = null;

// Current crawl run ID for Supabase integration
let currentRunId = null;

// Stop flag for canceling crawl
let shouldStop = false;
let currentBrowserPool = null;

/**
 * Set broadcast function for WebSocket updates
 * Called by server.js after initialization to avoid circular dependency
 */
export function setBroadcast(broadcastFn) {
  broadcast = broadcastFn;
  logger.info('WebSocket broadcast enabled for orchestrator');
}

/**
 * Broadcast log message via WebSocket
 * @param {string} level - Log level (info, success, error, warning)
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 */
function broadcastLog(level, message, metadata = {}) {
  console.log(`🔊 [broadcastLog] Called: [${level}] ${message}`);

  if (broadcast) {
    console.log(`✅ [broadcastLog] Broadcast function available, sending WebSocket message...`);
    broadcast({
      type: 'log',
      data: {
        level: level.toUpperCase(), // Convert to uppercase to match LogStream filter
        message,
        timestamp: new Date().toISOString(),
        context: metadata // Store metadata as context for LogStream
      }
    });
    console.log(`📤 [broadcastLog] Message broadcasted successfully`);
  } else {
    console.log(`❌ [broadcastLog] Broadcast function NOT available!`);
  }
}

/**
 * Stop the current crawl
 * Gracefully stops browser pool and cleans up resources
 */
export async function stopCrawl() {
  console.log('\n🛑 Crawl stop requested');
  shouldStop = true;

  // Broadcast stop event
  if (broadcast) {
    broadcast({
      type: 'crawl_stopped',
      message: 'Crawl stopped by user'
    });
  }

  // Close all browser contexts to terminate current validations
  if (currentBrowserPool && currentBrowserPool.isReady()) {
    console.log('🧹 Closing all browser contexts...');

    try {
      const poolSize = currentBrowserPool.getPoolSize();

      for (let i = 0; i < poolSize; i++) {
        try {
          const browser = currentBrowserPool.getBrowser(i);
          const contexts = browser.contexts();

          // Close all contexts in this browser
          await Promise.all(contexts.map(async (context) => {
            try {
              await context.close();
            } catch (err) {
              console.warn(`  ⚠️ Failed to close context in browser ${i + 1}:`, err.message);
            }
          }));

          console.log(`  ✅ Closed contexts for browser ${i + 1}/${poolSize}`);
        } catch (error) {
          console.warn(`  ⚠️ Warning: Failed to access browser ${i + 1}:`, error.message);
        }
      }

      console.log('✅ All browser contexts closed');
    } catch (error) {
      console.error('❌ Error closing browser contexts:', error.message);
    }
  }

  console.log('✅ Crawl stopped successfully');
  return {
    stopped: true,
    message: 'Crawl stopped and all browser contexts closed'
  };
}

// ==============================================================================
// Story 6.1: Retry Logic with Exponential Backoff
// ==============================================================================

/**
 * Classify error as retryable or non-retryable (AC5, AC6)
 *
 * Retryable errors:
 * - Network timeouts (ETIMEDOUT, ERR_CONNECTION_REFUSED)
 * - HTTP 5xx server errors
 * - Site down / unreachable
 *
 * Non-retryable errors:
 * - Measurement ID mismatch
 * - GTM ID mismatch
 * - Configuration errors
 *
 * @param {Error} error - Error object from validation attempt
 * @returns {boolean} True if error should trigger retry
 */
function isRetryableError(error, phase = null) {
  const errorMessage = error.message.toLowerCase();

  // Timeout errors should NOT retry in either phase
  // Phase 1: Queue for Phase 2 immediately
  // Phase 2: Already the last chance, just fail
  const isTimeoutError = errorMessage.includes('timeout') ||
                         errorMessage.includes('etimedout') ||
                         errorMessage.includes('navigation timeout');

  if (isTimeoutError) {
    return false; // Don't retry timeouts - Phase 1 goes to Phase 2, Phase 2 just fails
  }

  // Network-related errors (retryable)
  const networkErrors = [
    'timeout',
    'etimedout',
    'err_connection_refused',
    'err_connection_reset',
    'err_network_changed',
    'net::err_',
    'navigation timeout',
    'page crashed'
  ];

  if (networkErrors.some(pattern => errorMessage.includes(pattern))) {
    return true;
  }

  // HTTP 5xx errors (retryable)
  if (errorMessage.includes('http error 5') || errorMessage.match(/status code 5\d{2}/)) {
    return true;
  }

  // Configuration errors (non-retryable)
  const configErrors = [
    'measurement id mismatch',
    'gtm id mismatch',
    'measurement id not found',
    'gtm container id not found',
    'invalid configuration'
  ];

  if (configErrors.some(pattern => errorMessage.includes(pattern))) {
    return false;
  }

  // Default to non-retryable for unknown errors
  return false;
}

/**
 * Retry function with exponential backoff (AC1, AC2, AC4)
 *
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} baseBackoffMs - Base backoff in milliseconds (default: 1000)
 * @param {string} context - Context for logging (e.g., property name)
 * @param {number} phase - Current phase (1 or 2). Phase 1 timeouts should NOT retry.
 * @returns {Promise<any>} Result from successful function execution
 * @throws {Error} Last error if all retries fail
 */
async function retryWithBackoff(fn, maxRetries = 3, baseBackoffMs = 1000, context = '', phase = null) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Execute function
      const result = await fn();
      return result;

    } catch (error) {
      lastError = error;

      // Check if error is retryable (pass phase to prevent Phase 1 timeout retries)
      if (!isRetryableError(error, phase)) {
        console.log(`  ⚠️ Non-retryable error: ${error.message}`);
        throw error;
      }

      // Check if we have retries left
      if (attempt > maxRetries) {
        console.log(`  ❌ All ${maxRetries} retries exhausted${context ? ` for ${context}` : ''}`);
        throw error;
      }

      // Calculate backoff with exponential increase: 1s, 2s, 4s
      const backoffMs = baseBackoffMs * Math.pow(2, attempt - 1);

      // Log retry attempt (AC4)
      console.log(`  🔄 Retry ${attempt}/${maxRetries}${context ? ` for ${context}` : ''} after ${backoffMs}ms (${error.message})`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // Should never reach here, but throw last error as fallback
  throw lastError;
}

// ==============================================================================
// Story 2.2: Parallel Browser Execution Functions
// ==============================================================================

/**
 * Distribute properties evenly across browsers using round-robin (AC1)
 *
 * @param {Array<Property>} properties - Properties to distribute
 * @param {number} browserCount - Number of browsers in pool
 * @returns {Array<Array<Property>>} Array of property chunks, one per browser
 *
 * @example
 * // 100 properties, 5 browsers → [20, 20, 20, 20, 20]
 * const chunks = distributeProperties(properties, 5);
 */
export function distributeProperties(properties, browserCount) {
  if (!properties || properties.length === 0) {
    throw new Error('Properties array cannot be empty');
  }

  if (browserCount <= 0) {
    throw new Error('Browser count must be positive');
  }

  // Initialize empty chunks for each browser
  const chunks = Array.from({ length: browserCount }, () => []);

  // Round-robin distribution
  properties.forEach((property, index) => {
    const browserIndex = index % browserCount;
    chunks[browserIndex].push(property);
  });

  console.log(`📊 Properties distributed:`);
  chunks.forEach((chunk, index) => {
    console.log(`   Browser ${index + 1}: ${chunk.length} properties`);
  });

  return chunks;
}

/**
 * Validate properties assigned to a single browser worker (AC2, AC5)
 * Each property is processed sequentially with context clearing
 *
 * @param {Browser} browser - Playwright browser instance
 * @param {Array<Property>} properties - Properties assigned to this worker
 * @param {number} workerIndex - Worker identifier (0-based)
 * @param {string} dateStr - Date string for result storage
 * @returns {Promise<Object>} Worker results {workerIndex, results, errors, executionTimeMs}
 */
async function validateWorker(browser, properties, workerIndex, dateStr) {
  const workerStartTime = Date.now();
  const results = [];
  const errors = [];

  console.log(`\n👷 Worker ${workerIndex + 1} starting (${properties.length} properties)...`);

  try {
    // Process properties sequentially
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const propertyStartTime = Date.now();

      console.log(`\n👷 Worker ${workerIndex + 1} [${i + 1}/${properties.length}] - ${property.propertyName}`);

      try {
        // Validate single property
        const result = await validateSingleProperty(browser, property, dateStr);
        result.workerIndex = workerIndex;
        result.executionTimeMs = Date.now() - propertyStartTime;
        results.push(result);

        console.log(`   ✅ Completed in ${result.executionTimeMs}ms`);

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors.push({
          property,
          workerIndex,
          error: error.message
        });
      }

      // Context cleanup is handled by:
      // 1. validateSingleProperty closes the page after validation
      // 2. releaseBrowser closes all contexts when returning browser to pool
      // Removing duplicate cleanup here to prevent race conditions
    }

    const workerExecutionTime = Date.now() - workerStartTime;
    console.log(`\n✅ Worker ${workerIndex + 1} completed in ${(workerExecutionTime / 1000 / 60).toFixed(2)} minutes`);

    return {
      workerIndex,
      results,
      errors,
      executionTimeMs: workerExecutionTime
    };

  } catch (error) {
    const workerExecutionTime = Date.now() - workerStartTime;
    console.error(`\n❌ Worker ${workerIndex + 1} failed:`, error.message);

    return {
      workerIndex,
      results,
      errors: [...errors, { worker: workerIndex, error: error.message }],
      executionTimeMs: workerExecutionTime
    };
  }
}

/**
 * Fetch crawler timeout settings from database
 * @returns {Promise<Object>} {phase1Timeout, phase2Timeout} in milliseconds
 */
async function getCrawlerSettings() {
  try {
    const { data, error } = await supabase
      .from('crawler_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️  Failed to fetch crawler settings from database:', error.message);
      console.log('   Using default timeout values: Phase 1 = 20s, Phase 2 = 60s');
      return {
        phase1Timeout: 20000,
        phase2Timeout: 60000
      };
    }

    if (!data) {
      console.log('ℹ️  No crawler settings found in database, using defaults');
      return {
        phase1Timeout: 20000,
        phase2Timeout: 60000
      };
    }

    console.log('✅ Loaded crawler settings from database:', {
      phase1: `${data.phase1_timeout}s`,
      phase2: `${data.phase2_timeout}s`
    });

    return {
      phase1Timeout: data.phase1_timeout * 1000,
      phase2Timeout: data.phase2_timeout * 1000
    };
  } catch (error) {
    console.error('❌ Error fetching crawler settings:', error.message);
    console.log('   Using default timeout values: Phase 1 = 20s, Phase 2 = 60s');
    return {
      phase1Timeout: 20000,
      phase2Timeout: 60000
    };
  }
}

/**
 * Run parallel validation with Queue-based work distribution (OPTIMIZED)
 * Each browser independently pulls tasks from a shared queue, eliminating batch bottlenecks
 * Implements two-phase timeout strategy for optimal performance
 *
 * Phase 1: Fast validation with configurable timeout (catches 95%+ of properties)
 * Phase 2: Slow property re-validation with configurable timeout (only timeout-exceeded properties)
 *
 * @param {BrowserPool} browserPool - Initialized browser pool
 * @param {Array<Property>} properties - All properties to validate
 * @param {string} dateStr - Date string for result storage
 * @returns {Promise<Object>} {results, errors, executionTimeMs, workerStats, phase2Results}
 */
export async function runParallelValidation(browserPool, properties, dateStr) {
  if (!browserPool.isReady()) {
    throw new Error('Browser pool must be initialized before validation');
  }

  const parallelStartTime = Date.now();
  const poolSize = browserPool.getPoolSize();

  // Fetch timeout settings from database (database settings override environment variables)
  const settings = await getCrawlerSettings();
  // Priority: 1) Database settings, 2) Environment variables (for backward compatibility)
  const phase1Timeout = settings.phase1Timeout || parseInt(process.env.GA4_TIMEOUT_MS) || 20000;
  const phase2Timeout = settings.phase2Timeout || parseInt(process.env.GA4_SLOW_TIMEOUT_MS) || 60000;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting Queue-Based Parallel Validation');
  console.log('='.repeat(60));
  console.log(`Total Properties: ${properties.length}`);
  console.log(`Browser Workers: ${poolSize}`);
  console.log(`Phase 1 Timeout: ${phase1Timeout / 1000}s`);
  console.log(`Phase 2 Timeout: ${phase2Timeout / 1000}s (for slow properties)`);
  console.log('='.repeat(60));

  broadcastLog('info', `🚀 Starting validation: ${properties.length} properties with ${poolSize} workers`, {
    totalProperties: properties.length,
    browserWorkers: poolSize,
    phase1Timeout: phase1Timeout / 1000,
    phase2Timeout: phase2Timeout / 1000
  });

  // ==================== PHASE 1: Fast Validation ====================
  console.log('\n📍 PHASE 1: Fast validation (30s timeout)...\n');
  broadcastLog('info', `📍 Phase 1: Fast validation started (${phase1Timeout / 1000}s timeout)`);

  // Initialize temp cache for storing results
  const tempCache = getTempCache();

  // Shared queue and results (thread-safe with single-threaded JS)
  const propertyQueue = [...properties];
  const phase1Results = [];
  const phase1Errors = [];
  const timeoutExceededProperties = [];
  const timedOutPropertyIds = new Set(); // Track timed-out property IDs to prevent duplicate storage
  const workerStats = [];
  // completedCount removed - using phase1Results.length + timeoutExceededProperties.length + phase1Errors.length instead
  let activeWorkers = 0; // Track number of workers currently processing

  // Queue-based worker function
  const queueWorker = async (workerIndex) => {
    const workerStartTime = Date.now();
    const workerResults = [];
    const workerErrors = [];
    let processedCount = 0;
    let browser = null;
    let browserIndex = -1;

    try {
      // Acquire browser from pool
      const browserAllocation = await browserPool.acquireBrowser();
      browser = browserAllocation.browser;
      browserIndex = browserAllocation.index;
      console.log(`\n👷 Worker ${workerIndex + 1} (Browser ${browserIndex + 1}) started`);
      broadcastLog('info', `Worker ${workerIndex + 1} started`, { workerIndex, browserIndex });

      while (propertyQueue.length > 0) {
        // Check stop flag
        if (shouldStop) {
          console.log(`\n🛑 Worker ${workerIndex + 1} stopped by user`);
          broadcastLog('warning', `Worker ${workerIndex + 1} stopped by user`, { workerIndex });
          break;
        }

        const property = propertyQueue.shift();
        if (!property) break; // Queue exhausted

        processedCount++;
        // completedCount++; // REMOVED: This was counting "started" not "completed"
        activeWorkers++; // Increment active workers
        const propertyStartTime = Date.now();

        // Calculate actual completed count (success + timeout + error)
        const actualCompletedCount = phase1Results.length + timeoutExceededProperties.length + phase1Errors.length;
        console.log(`\n👷 Worker ${workerIndex + 1} [${actualCompletedCount}/${properties.length}] - ${property.propertyName}`);
        broadcastLog('info', `Processing: ${property.propertyName} [${actualCompletedCount}/${properties.length}]`, {
          workerIndex,
          propertyName: property.propertyName,
          progress: `${actualCompletedCount}/${properties.length}`
        });

        try {
          // Validate with Phase 1 timeout (passed directly to avoid background validation)
          const result = await validateSingleProperty(browser, property, dateStr, 1, timedOutPropertyIds, phase1Timeout);

          result.workerIndex = workerIndex;
          result.executionTimeMs = Date.now() - propertyStartTime;
          result.phase = 1;
          workerResults.push(result);
          phase1Results.push(result); // Add to shared array immediately for real-time progress

          console.log(`   ✅ Completed in ${result.executionTimeMs}ms`);
          broadcastLog('success', `✅ ${property.propertyName} completed in ${result.executionTimeMs}ms`, {
            propertyName: property.propertyName,
            executionTime: result.executionTimeMs,
            hasIssues: result.hasIssues
          });

          activeWorkers--; // Decrement active workers after completion

          // Update progress state and broadcast
          // Phase 1 진행률: 0-70% 범위로 계산 (Phase 2는 70-100%, 즉 30% 범위)
          // Use actual completed count (phase1Results + timeoutExceeded), not started count
          const actualCompletedCount = phase1Results.length + timeoutExceededProperties.length;
          const phase1ProgressPercent = Math.min(Math.round((actualCompletedCount / properties.length) * 70), 70);

          updateCrawlProgress({
            total: properties.length,
            completed: Math.round((phase1ProgressPercent / 100) * properties.length),
            phase: 1,
            phase1Completed: phase1Results.length, // Only successful validations (for completed count display)
            phase1Processed: actualCompletedCount, // All processed (for progress bar %)
            current: {
              propertyName: property.propertyName,
              url: property.representativeUrl,
              status: result.hasIssues ? 'has_issues' : 'success',
              phase: 1,
              startedAt: propertyStartTime // Add property start time
            }
          });

          // Broadcast progress update via WebSocket
          if (broadcast) {
            const crawlState = getCrawlState();
            const broadcastData = {
              type: 'crawl_status',
              data: {
                ...crawlState,
                browserPoolSize: poolSize,
                activeBrowsers: activeWorkers // Use actual active workers count
              }
            };
            console.log(`  📡 Broadcasting progress update: phase1Completed=${phase1Results.length}, phase1Processed=${actualCompletedCount}`);
            broadcast(broadcastData);
          }

        } catch (error) {
          activeWorkers--; // Decrement active workers on error

          // Check if error is timeout-related (navigation timeout)
          const isTimeout = error.message.toLowerCase().includes('timeout') ||
                           error.message === 'TIMEOUT_EXCEEDED';

          if (isTimeout) {
            console.log(`   ⏱️ Timeout (${phase1Timeout / 1000}s) - Queued for Phase 2`);
            broadcastLog('warning', `⏱️ ${property.propertyName} timeout - queued for Phase 2`, {
              propertyName: property.propertyName,
              timeout: phase1Timeout / 1000
            });

            // Mark property as timed out to prevent storing late-arriving results
            const propertyId = property._supabaseId || property.slug;
            timedOutPropertyIds.add(propertyId);
            console.log(`  🔒 Marked ${propertyId} as timed out - late results will be ignored`);

            timeoutExceededProperties.push(property);

            // **SOLUTION: Persist Phase 2 queue to database for recovery after restart**
            // Store timeout result in database with queued_for_phase2 flag
            const timeoutResult = {
              propertyName: property.propertyName,
              accountName: property.accountName,
              slug: property.slug,
              validationTime: new Date().toISOString(),
              url: property.representativeUrl,
              isValid: false,
              error: error.message,
              issues: [{
                type: 'TIMEOUT',
                severity: 'warning',
                message: `Phase 1 timeout (${phase1Timeout / 1000}s) - queued for Phase 2`
              }],
              executionTimeMs: Date.now() - propertyStartTime,
              hasIssues: true,
              validationStatus: 'timeout',
              issueTypes: ['TIMEOUT'],
              issueSummary: `Phase 1 timeout: ${error.message}`,
              queuedForPhase2: true, // Flag to identify Phase 2 queue
              pageView: null,
              collectedGA4Id: null,
              collectedGTMIds: [],
              pageLoad: {
                statusCode: null,
                finalUrl: property.representativeUrl,
                redirected: false,
                requestedUrl: property.representativeUrl
              }
            };

            // Store in temp cache with phase2 flag
            try {
              await tempCache.addResult(timeoutResult, propertyId);
              console.log(`  💾 Timeout result stored in cache for Phase 2 recovery`);
            } catch (cacheError) {
              console.error(`  ⚠️ Failed to cache timeout result: ${cacheError.message}`);
            }

            // Update progress for timeout properties as well
            // Phase 1 진행률: 처리된 속성 수 / 전체 * 70%
            // Use actual completed count (phase1Results + timeoutExceeded), not started count
            const actualCompletedCount = phase1Results.length + timeoutExceededProperties.length;
            const phase1ProgressPercent = Math.min(Math.round((actualCompletedCount / properties.length) * 70), 70);

            updateCrawlProgress({
              total: properties.length,
              completed: Math.round((phase1ProgressPercent / 100) * properties.length),
              phase: 1,
              phase1Completed: phase1Results.length, // Only successful validations (for completed count display)
              phase1Processed: actualCompletedCount, // All processed (for progress bar %)
              phase2Total: timeoutExceededProperties.length, // Timeout properties queued for Phase 2
              current: {
                propertyName: property.propertyName,
                url: property.representativeUrl,
                status: 'timeout',
                phase: 1,
                startedAt: propertyStartTime
              }
            });

            // Broadcast progress update via WebSocket
            if (broadcast) {
              const crawlState = getCrawlState();
              const broadcastData = {
                type: 'crawl_status',
                data: {
                  ...crawlState,
                  browserPoolSize: poolSize,
                  activeBrowsers: activeWorkers
                }
              };
              console.log(`  📡 Broadcasting timeout progress: phase1Completed=${phase1Results.length}, phase1Processed=${actualCompletedCount}, phase2Total=${timeoutExceededProperties.length}`);
              broadcast(broadcastData);
            }
          } else {
            console.error(`   ❌ Error: ${error.message}`);
            broadcastLog('error', `❌ ${property.propertyName} error: ${error.message}`, {
              propertyName: property.propertyName,
              error: error.message
            });

            // Create error result object for database storage
            const errorResult = {
              property,
              workerIndex,
              phase: 1,
              executionTimeMs: Date.now() - propertyStartTime,
              hasIssues: true,
              validationStatus: 'failed',
              issueTypes: ['VALIDATION_ERROR'],
              issueSummary: `Validation error: ${error.message}`,
              error: error.message,
              pageView: null,
              collectedGA4Id: null,
              collectedGTMIds: [],
              pageLoad: {
                statusCode: null,
                finalUrl: property.representativeUrl,
                redirected: false,
                requestedUrl: property.representativeUrl
              }
            };

            // Add to phase1Errors and phase1Results for consistent tracking
            phase1Errors.push(errorResult);
            phase1Results.push(errorResult); // Add to results for database storage
            workerErrors.push(errorResult); // Add to worker errors for worker stats

            // Store error result in temp cache
            const phase1ErrorPropertyId = property._supabaseId || property.slug;
            console.log(`     propertyId: ${phase1ErrorPropertyId} (${property._supabaseId ? 'UUID' : 'slug fallback'})`);

            try {
              await tempCache.addResult(errorResult, phase1ErrorPropertyId);
              console.log(`  💾 Error result stored in cache for ${property.propertyName}`);
            } catch (cacheError) {
              console.error(`  ⚠️ Failed to cache error result: ${cacheError.message}`);
              logger.error('Phase 1 error result cache storage failed', {
                propertyName: property.propertyName,
                propertyId: phase1ErrorPropertyId,
                error: cacheError.message
              });
            }

            // Update progress for error properties as well
            const actualCompletedCount = phase1Results.length + timeoutExceededProperties.length;
            const phase1ProgressPercent = Math.min(Math.round((actualCompletedCount / properties.length) * 70), 70);

            updateCrawlProgress({
              total: properties.length,
              completed: Math.round((phase1ProgressPercent / 100) * properties.length),
              failed: phase1Errors.length,
              phase: 1,
              phase1Completed: phase1Results.length - phase1Errors.length, // Exclude errors from completed count
              phase1Processed: actualCompletedCount,
              current: {
                propertyName: property.propertyName,
                url: property.representativeUrl,
                status: 'error',
                phase: 1,
                startedAt: propertyStartTime
              }
            });

            // Broadcast progress update via WebSocket
            if (broadcast) {
              const crawlState = getCrawlState();
              broadcast({
                type: 'crawl_status',
                data: {
                  ...crawlState,
                  browserPoolSize: poolSize,
                  activeBrowsers: activeWorkers
                }
              });
            }
          }
        }

        // Context cleanup is handled by:
        // 1. validateSingleProperty closes the page after validation
        // 2. releaseBrowser closes all contexts when returning browser to pool
        // Removing duplicate cleanup here to prevent race conditions
      }

      const workerExecutionTime = Date.now() - workerStartTime;
      console.log(`\n✅ Worker ${workerIndex + 1} completed ${processedCount} properties in ${(workerExecutionTime / 1000 / 60).toFixed(2)} minutes`);
      broadcastLog('success', `✅ Worker ${workerIndex + 1} finished: ${processedCount} properties`, {
        workerIndex,
        processedCount,
        executionTime: (workerExecutionTime / 1000 / 60).toFixed(2)
      });

      return {
        workerIndex,
        results: workerResults,
        errors: workerErrors,
        executionTimeMs: workerExecutionTime,
        processedCount
      };

    } catch (error) {
      console.error(`\n❌ Worker ${workerIndex + 1} critical error:`, error.message);
      return {
        workerIndex,
        results: workerResults,
        errors: [...workerErrors, { worker: workerIndex, error: error.message }],
        executionTimeMs: Date.now() - workerStartTime,
        processedCount
      };
    } finally {
      // Release browser only if it was successfully acquired
      if (browserIndex >= 0) {
        await browserPool.releaseBrowser(browserIndex);
        console.log(`🔄 Worker ${workerIndex + 1} (Browser ${browserIndex + 1}) released to pool`);
      }
    }
  };

  // Launch all workers concurrently
  const workerPromises = Array.from({ length: poolSize }, (_, index) => queueWorker(index));
  const phase1WorkerResults = await Promise.all(workerPromises);

  // Aggregate Phase 1 results
  phase1WorkerResults.forEach(workerResult => {
    // Safety check: skip undefined or invalid worker results
    if (!workerResult || !workerResult.errors) {
      console.warn('⚠️ Skipping invalid worker result:', workerResult);
      return;
    }

    // phase1Results already populated in real-time during worker execution
    // phase1Errors already populated in real-time during worker execution
    workerStats.push({
      workerIndex: workerResult.workerIndex,
      phase: 1,
      propertyCount: workerResult.processedCount || 0,
      errorCount: workerResult.errors.length,
      executionTimeMs: workerResult.executionTimeMs || 0
    });
  });

  const phase1Time = Date.now() - parallelStartTime;

  broadcastLog('success', `✅ Phase 1 completed: ${phase1Results.length} properties in ${(phase1Time / 1000).toFixed(1)}s`, {
    phase: 1,
    completed: phase1Results.length,
    timeoutExceeded: timeoutExceededProperties.length,
    errors: phase1Errors.length,
    executionTime: phase1Time / 1000
  });

  // ==================== PHASE 2: Slow Property Re-validation ====================
  let phase2Results = [];
  let phase2Time = 0;

  // **SOLUTION: Restore Phase 2 queue from database after server restart**
  // Check database for properties that timed out in Phase 1 but don't have Phase 2 results yet
  console.log('\n🔍 Checking for Phase 2 queue in database...');
  try {
    const { data: timeoutResults, error: timeoutError } = await supabase
      .from('crawl_results')
      .select('property_id, properties(*)')
      .eq('crawl_run_id', runId)
      .eq('phase', 1)
      .eq('validation_status', 'timeout');

    if (timeoutError) {
      console.error('⚠️ Error loading Phase 2 queue from database:', timeoutError.message);
    } else if (timeoutResults && timeoutResults.length > 0) {
      // Check which properties don't have Phase 2 results yet
      const { data: phase2Existing, error: phase2Error } = await supabase
        .from('crawl_results')
        .select('property_id')
        .eq('crawl_run_id', runId)
        .eq('phase', 2);

      const phase2PropertyIds = new Set(phase2Existing?.map(r => r.property_id) || []);

      // Add properties that don't have Phase 2 results yet
      const restoredProperties = timeoutResults
        .filter(r => !phase2PropertyIds.has(r.property_id) && r.properties)
        .map(r => ({
          _supabaseId: r.property_id,
          propertyName: r.properties.property_name,
          accountName: r.properties.account_name,
          slug: r.properties.slug,
          measurementId: r.properties.measurement_id,
          webGTMId: r.properties.web_gtm_id,
          representativeUrl: r.properties.url
        }));

      if (restoredProperties.length > 0) {
        console.log(`✅ Restored ${restoredProperties.length} properties from database for Phase 2`);
        timeoutExceededProperties.push(...restoredProperties);
      } else {
        console.log('ℹ️  No additional properties to restore (all have Phase 2 results)');
      }
    } else {
      console.log('ℹ️  No Phase 1 timeout properties found in database');
    }
  } catch (restoreError) {
    console.error('⚠️ Error restoring Phase 2 queue:', restoreError.message);
  }

  if (timeoutExceededProperties.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log(`📍 PHASE 2: Re-validating ${timeoutExceededProperties.length} slow properties (60s timeout)...`);
    console.log('='.repeat(60) + '\n');

    broadcastLog('info', `📍 Phase 2: Re-validating ${timeoutExceededProperties.length} slow properties (${phase2Timeout / 1000}s timeout)`, {
      phase: 2,
      slowProperties: timeoutExceededProperties.length
    });

    const phase2StartTime = Date.now();
    const phase2Queue = [...timeoutExceededProperties];

    let phase2CompletedCount = 0;
    const phase2Total = timeoutExceededProperties.length;
    // Phase 2 includes both GA4 wait (60s) + GTM wait (30s) = 90s total
    const gtmWaitTimeout = 30000; // GTM lazy loader wait time
    const phase2MaxTimePerProperty = phase2Timeout + gtmWaitTimeout; // 90000ms (60s + 30s)

    // Calculate expected batches and max duration
    const batches = Math.ceil(phase2Total / poolSize);
    const phase2MaxDuration = batches * phase2MaxTimePerProperty; // Maximum possible duration
    const phase2StartTimestamp = Date.now();

    // Track current processing property for periodic updates
    let currentProperty = null;
    let currentPropertyStartTime = null;
    let phase2ActiveWorkers = 0; // Track active workers in Phase 2

    // Set up periodic progress updates (every 2 seconds)
    const progressUpdateInterval = setInterval(() => {
      // Check stop flag - stop broadcasting if crawl was stopped
      if (shouldStop) {
        clearInterval(progressUpdateInterval);
        console.log('⏹️ Phase 2 progress updates stopped');
        return;
      }

      const elapsedTime = Date.now() - phase2StartTimestamp;

      // Story 10.1: Time-based progress for Phase 2 (with dynamic duration adjustment)
      // Calculate remaining duration based on completed properties
      const remainingProperties = phase2Total - phase2CompletedCount;
      const remainingBatches = Math.ceil(remainingProperties / poolSize);
      const dynamicMaxDuration = remainingBatches * phase2MaxTimePerProperty;

      // Time-based progress: 0-30% based on elapsed time vs dynamic max duration
      const timeBasedProgress = dynamicMaxDuration > 0
        ? Math.min((elapsedTime / dynamicMaxDuration) * 30, 30)
        : 30;

      const phase2Progress = phase2CompletedCount >= phase2Total ? 30 : Math.min(timeBasedProgress, 30);

      // Calculate completed based on actual property completion
      // Phase 1: 35 properties (success in Phase 1)
      // Phase 2: 28/47 properties completed in Phase 2
      // Total completed: 35 + 28 = 63 out of 82
      const actualCompleted = phase1Results.length + phase2CompletedCount;

      const progressUpdate = {
        total: properties.length,
        completed: actualCompleted, // Use actual completed count instead of percentage-based calculation
        phase: 2,
        phase1Completed: phase1Results.length,
        phase2Completed: phase2CompletedCount,
        phase2Total: phase2Total,
        phase2Progress: Math.round(phase2Progress),
        phase2MaxDuration: Math.round(phase2MaxDuration / 1000),
        phase2ElapsedTime: Math.round(elapsedTime / 1000),
        browserPoolSize: poolSize,
        activeBrowsers: phase2ActiveWorkers // Active workers in Phase 2
      };

      // Add current property info if available
      if (currentProperty && currentPropertyStartTime) {
        progressUpdate.current = {
          propertyName: currentProperty.propertyName,
          url: currentProperty.representativeUrl,
          phase: 2,
          startedAt: currentPropertyStartTime
        };
      }

      updateCrawlProgress(progressUpdate);

      if (broadcast) {
        const crawlState = getCrawlState();
        broadcast({
          type: 'crawl_status',
          data: {
            ...crawlState,
            browserPoolSize: poolSize
          }
        });
      }
    }, 2000); // Update every 2 seconds

    const phase2Worker = async (workerIndex) => {
      const results = [];
      let browser = null;
      let browserIndex = -1;

      try {
        // Acquire browser from pool
        const browserAllocation = await browserPool.acquireBrowser();
        browser = browserAllocation.browser;
        browserIndex = browserAllocation.index;
        while (phase2Queue.length > 0) {
          // Check stop flag
          if (shouldStop) {
            console.log(`\n🛑 Phase 2 Worker ${workerIndex + 1} stopped by user`);
            broadcastLog('warning', `Phase 2 Worker ${workerIndex + 1} stopped by user`, { workerIndex, phase: 2 });
            break;
          }

          const property = phase2Queue.shift();
          if (!property) break;

          const propertyStartTime = Date.now(); // Track start time for each property
          phase2ActiveWorkers++; // Increment active workers

          // Update current property being processed
          currentProperty = property;
          currentPropertyStartTime = propertyStartTime;

          console.log(`\n👷 Phase 2 Worker ${workerIndex + 1} - ${property.propertyName}`);

          try {
            // Pass timeout directly to validateSingleProperty to prevent background validation
            const result = await validateSingleProperty(browser, property, dateStr, 2, null, phase2Timeout);

            result.phase = 2;
            results.push(result);
            phase2CompletedCount++;
            phase2ActiveWorkers--; // Decrement active workers after completion
            console.log(`   ✅ Completed in ${result.executionTimeMs || 0}ms`);

            // Progress updates are handled by the periodic update interval (lines 658-718)
            // No need for per-property updates as they caused erratic progress bar behavior

            // Broadcast progress update via WebSocket
            if (broadcast) {
              const crawlState = getCrawlState();
              broadcast({
                type: 'crawl_status',
                data: {
                  ...crawlState,
                  browserPoolSize: poolSize,
                  activeBrowsers: phase2ActiveWorkers
                }
              });
            }

          } catch (error) {
            phase2ActiveWorkers--; // Decrement active workers on error

            console.error(`   ❌ Phase 2 Error: ${error.message}`);
            broadcastLog('error', `❌ Phase 2 ${property.propertyName} error: ${error.message}`, {
              propertyName: property.propertyName,
              error: error.message,
              phase: 2
            });

            // Create error result object for database storage
            const isTimeout = error.message.toLowerCase().includes('timeout') ||
                             error.message === 'PHASE2_TIMEOUT';

            const errorResult = {
              property,
              workerIndex,
              phase: 2,
              executionTimeMs: Date.now() - propertyStartTime,
              hasIssues: true,
              validationStatus: 'failed',
              issueTypes: ['VALIDATION_ERROR'],
              issueSummary: isTimeout
                ? `Phase 2 timeout (${phase2Timeout / 1000}s)`
                : `Phase 2 validation error: ${error.message}`,
              error: error.message,
              pageView: null,
              collectedGA4Id: null,
              collectedGTMIds: [],
              pageLoad: {
                statusCode: null,
                finalUrl: property.representativeUrl,
                redirected: false,
                requestedUrl: property.representativeUrl
              }
            };

            // Add to results for database storage
            results.push(errorResult);
            phase1Errors.push(errorResult); // Keep for summary (note: should be phase2Errors but keeping for backward compatibility)

            // Store error result in temp cache
            const phase2ErrorPropertyId = property._supabaseId || property.slug;
            console.log(`     propertyId: ${phase2ErrorPropertyId} (${property._supabaseId ? 'UUID' : 'slug fallback'})`);

            try {
              await tempCache.addResult(errorResult, phase2ErrorPropertyId);
              console.log(`  💾 Phase 2 error result stored in cache for ${property.propertyName}`);
            } catch (cacheError) {
              console.error(`  ⚠️ Failed to cache Phase 2 error result: ${cacheError.message}`);
              logger.error('Phase 2 error result cache storage failed', {
                propertyName: property.propertyName,
                propertyId: phase2ErrorPropertyId,
                error: cacheError.message
              });
            }

            // Add to retry queue for network-related failures (Story 10.3)
            if (property._supabaseId && currentRunId) {
              try {
                const nextRetryAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                await supabase
                  .from('retry_queue')
                  .insert({
                    property_id: property._supabaseId,
                    crawl_run_id: currentRunId,
                    failure_reason: errorResult.issueSummary,
                    next_retry_at: nextRetryAt.toISOString()
                  });

                console.log(`  📋 Added to retry queue (will retry in 30 minutes)`);
                logger.info('Property added to retry queue', {
                  propertyName: property.propertyName,
                  propertyId: property._supabaseId,
                  nextRetryAt: nextRetryAt.toISOString()
                });
              } catch (queueError) {
                console.error(`  ⚠️ Failed to add to retry queue: ${queueError.message}`);
                logger.error('Retry queue insertion failed', {
                  propertyName: property.propertyName,
                  propertyId: property._supabaseId,
                  error: queueError.message
                });
              }
            }

            // Broadcast progress update via WebSocket
            if (broadcast) {
              const crawlState = getCrawlState();
              broadcast({
                type: 'crawl_status',
                data: {
                  ...crawlState,
                  browserPoolSize: poolSize,
                  activeBrowsers: phase2ActiveWorkers
                }
              });
            }
          }

          // Context cleanup is handled by:
          // 1. validateSingleProperty closes the page after validation
          // 2. releaseBrowser closes all contexts when returning browser to pool
          // Removing duplicate cleanup here to prevent race conditions
        }

        return results;

      } catch (error) {
        console.error(`\n❌ Phase 2 Worker ${workerIndex + 1} critical error:`, error.message);
        return results; // Return whatever results we have so far
      } finally {
        // Release browser only if it was successfully acquired
        if (browserIndex >= 0) {
          await browserPool.releaseBrowser(browserIndex);
        }
      }
    };

    const phase2WorkerPromises = Array.from({ length: poolSize }, (_, index) => phase2Worker(index));
    const phase2WorkerResults = await Promise.all(phase2WorkerPromises);

    phase2WorkerResults.forEach(results => {
      // Safety check: skip undefined or invalid results
      if (!results || !Array.isArray(results)) {
        console.warn('⚠️ Skipping invalid Phase 2 worker results:', results);
        return;
      }
      phase2Results.push(...results);
    });

    phase2Time = Date.now() - phase2StartTime;

    // Send final 100% progress update before clearing interval
    // Calculate actual completed count (successful + failed, excluding errors from both phases)
    const totalSuccessful = phase1Results.length + phase2Results.length;
    const totalErrors = phase1Errors.length;
    const actualCompleted = totalSuccessful + totalErrors;

    const finalProgressUpdate = {
      total: properties.length,
      completed: actualCompleted, // Use actual completed count, not total properties
      phase: 2,
      phase1Completed: phase1Results.length - phase1Errors.filter(e => e.phase === 1).length, // Exclude Phase 1 errors
      phase2Completed: phase2Results.length,
      phase2Total: phase2Total,
      phase2Progress: 30, // Full 30% for phase 2
      phase2MaxDuration: Math.round(phase2Time / 1000),
      phase2ElapsedTime: Math.round(phase2Time / 1000),
      browserPoolSize: poolSize,
      activeBrowsers: 0
    };

    // Update crawl progress state and broadcast via WebSocket
    updateCrawlProgress(finalProgressUpdate);

    if (broadcast) {
      const crawlState = getCrawlState();
      broadcast({
        type: 'crawl_status',
        data: {
          ...crawlState,
          browserPoolSize: poolSize,
          activeBrowsers: 0
        }
      });
    }

    // Clear the progress update interval
    clearInterval(progressUpdateInterval);
  }

  // ==================== FINAL RESULTS ====================
  const allResults = [...phase1Results, ...phase2Results];
  const allErrors = phase1Errors;
  const totalExecutionTimeMs = Date.now() - parallelStartTime;
  const totalExecutionMinutes = (totalExecutionTimeMs / 1000 / 60).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Queue-Based Validation Completed');
  console.log('='.repeat(60));
  console.log(`Total Execution Time: ${totalExecutionMinutes} minutes`);
  console.log(`  Phase 1 (Fast): ${(phase1Time / 1000 / 60).toFixed(2)} minutes`);
  if (timeoutExceededProperties.length > 0) {
    console.log(`  Phase 2 (Slow): ${(phase2Time / 1000 / 60).toFixed(2)} minutes`);
  }
  console.log(`Successful Validations: ${allResults.length}`);
  console.log(`Failed Validations: ${allErrors.length}`);
  console.log(`Timeout-Exceeded Properties (Phase 2): ${timeoutExceededProperties.length}`);
  console.log(`Average Time per Property: ${(totalExecutionTimeMs / properties.length / 1000).toFixed(1)}s`);
  console.log('='.repeat(60) + '\n');

  return {
    results: allResults,
    errors: allErrors,
    executionTimeMs: totalExecutionTimeMs,
    workerStats,
    phase2Results,
    timeoutExceededCount: timeoutExceededProperties.length
  };
}

/**
 * Main orchestration function
 *
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Execution result
 */
export async function runValidation(config) {
  const {
    csvPath,
    browserPoolSize = 5,
    retentionDays = 30,
    properties: providedProperties, // Properties from Supabase
    runId // Crawl run ID for Supabase integration
  } = config;

  // Reset stop flag for new crawl
  shouldStop = false;

  // Set current run ID for Supabase integration
  currentRunId = runId;

  const executionId = new Date().toISOString();
  const dateStr = executionId.split('T')[0];
  const startTime = Date.now();

  // Log execution start (AC1)
  logger.info('='.repeat(60));
  logger.info('Validation execution started', {
    executionId,
    date: dateStr,
    browserPoolSize,
    dataSource: providedProperties ? 'Supabase' : 'CSV',
    csvPath: csvPath || 'N/A'
  });
  logger.info('='.repeat(60));

  console.log('\n' + '='.repeat(60));
  console.log('🚀 GA4 Tech Issue Catcher');
  console.log('='.repeat(60));
  console.log(`Execution ID: ${executionId}`);
  console.log(`Date: ${dateStr}`);
  console.log(`Browser Pool Size: ${browserPoolSize}`);
  console.log(`Data Source: ${providedProperties ? 'Supabase' : 'CSV'}`);
  console.log('='.repeat(60) + '\n');

  let browserPool;
  const results = [];
  const tempCache = getTempCache();

  try {
    // Step 0: Initialize temp cache
    console.log('📦 Step 0: Initializing temp cache...\n');
    await tempCache.initialize();
    console.log('✅ Temp cache initialized\n');

    // Step 1: Cleanup old files
    console.log('🧹 Step 1: Cleaning up old files...\n');
    await cleanupOldFiles('results', retentionDays);
    await cleanupOldFiles('screenshots', retentionDays);

    // Step 2: Load properties from Supabase or CSV
    let properties;

    if (providedProperties) {
      console.log('\n📂 Step 2: Using properties from Supabase...\n');
      logger.info(`Using ${providedProperties.length} properties from Supabase`);

      // Debug: Log first property to verify slug
      if (providedProperties.length > 0) {
        console.log('🔍 Sample property structure:', {
          propertyName: providedProperties[0].propertyName,
          slug: providedProperties[0].slug,
          hasSlug: 'slug' in providedProperties[0]
        });
      }

      properties = providedProperties;
    } else {
      console.log('\n📂 Step 2: Loading properties from CSV...\n');
      logger.info(`Loading properties from CSV: ${csvPath}`);
      properties = await loadPropertiesFromCSV(csvPath);

      // Enrich CSV properties with _supabaseId from database
      console.log('🔗 Enriching CSV properties with Supabase IDs...\n');
      const { data: dbProperties, error: dbError } = await supabase
        .from(Tables.PROPERTIES)
        .select('id, slug, expected_ga4_id')
        .eq('is_active', true);

      if (dbError) {
        console.warn('⚠️ Failed to fetch Supabase IDs:', dbError.message);
        console.warn('⚠️ Proceeding with slug-based IDs (may cause batch upload issues)');
      } else {
        // Create lookup map: slug -> UUID
        const slugToIdMap = new Map(dbProperties.map(p => [p.slug, p.id]));

        // Also try matching by measurementId as fallback
        const measurementIdToIdMap = new Map(dbProperties.map(p => [p.expected_ga4_id, p.id]));

        // Enrich properties with _supabaseId
        let enriched = 0;
        properties = properties.map(prop => {
          let supabaseId = slugToIdMap.get(prop.slug) || measurementIdToIdMap.get(prop.measurementId);

          if (supabaseId) {
            enriched++;
            return { ...prop, _supabaseId: supabaseId };
          } else {
            console.warn(`⚠️ No Supabase ID found for property: ${prop.propertyName} (slug: ${prop.slug})`);
            return prop; // Keep original property without _supabaseId
          }
        });

        console.log(`✅ Enriched ${enriched}/${properties.length} properties with Supabase IDs\n`);
      }
    }

    if (properties.length === 0) {
      const errorMsg = 'No valid properties found in CSV';
      logger.error(errorMsg); // Fatal error (AC5)
      throw new Error(errorMsg);
    }

    logger.info(`Loaded ${properties.length} properties from CSV`);

    // Step 2.5: Detect property changes
    const cachePath = '.cache/last-properties.json';
    const previousProperties = await loadPreviousProperties(cachePath);

    if (previousProperties.length > 0) {
      const changes = detectPropertyChanges(previousProperties, properties);

      if (changes.added.length > 0) {
        console.log(`\n✨ Added Properties (${changes.added.length}):`);
        changes.added.forEach(p => {
          console.log(`   • ${p.propertyName} (${p.measurementId})`);
        });
      }

      if (changes.removed.length > 0) {
        console.log(`\n🗑️  Removed Properties (${changes.removed.length}):`);
        changes.removed.forEach(p => {
          console.log(`   • ${p.propertyName} (${p.measurementId})`);
        });
      }

      if (changes.added.length === 0 && changes.removed.length === 0) {
        console.log('\n✅ No property changes detected');
      }
    } else {
      console.log('\n📝 First execution - no previous property list found');
    }

    // Save current properties for next execution
    await savePreviousProperties(properties, cachePath);

    // Broadcast validation started event
    if (broadcast) {
      broadcast({
        type: 'validation_started',
        data: {
          executionId,
          totalProperties: properties.length,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Step 3: Initialize browser pool
    console.log('\n🌐 Step 3: Initializing browser pool...\n');
    browserPool = new BrowserPool(browserPoolSize);
    currentBrowserPool = browserPool; // Store for stop function
    await browserPool.initialize();

    // Step 4: Validate properties in parallel (Queue-based with 2-phase timeout)
    console.log('\n🔍 Step 4: Validating properties...\n');
    const { results: validationResults, errors, timeoutExceededCount } = await runParallelValidation(
      browserPool,
      properties,
      dateStr
    );

    results.push(...validationResults);

    // Step 4.5: Batch upload cached results to Supabase
    console.log('\n📤 Step 4.5: Batch uploading results to Supabase...\n');
    try {
      const batchUploader = new BatchUploadManager();
      const cacheData = tempCache.getAllData();

      console.log(`Cache contains:`);
      console.log(`  - Results: ${cacheData.results.length}`);
      console.log(`  - Screenshots: ${cacheData.screenshots.length}`);

      const uploadSummary = await batchUploader.uploadAll(currentRunId, cacheData);

      console.log('\n📊 Upload Summary:');
      console.log(`  - Results: ${uploadSummary.results.success}/${uploadSummary.results.total} uploaded`);
      console.log(`  - Screenshots: ${uploadSummary.screenshots.success}/${uploadSummary.screenshots.total} uploaded`);
      console.log(`  - Duration: ${(uploadSummary.duration / 1000).toFixed(2)}s`);

      // Update crawl_runs with upload statistics
      if (currentRunId) {
        await supabase
          .from(Tables.CRAWL_RUNS)
          .update({
            upload_completed_at: new Date().toISOString(),
            upload_duration_ms: uploadSummary.duration,
            upload_success_count: uploadSummary.results.success + uploadSummary.screenshots.success,
            upload_failed_count: uploadSummary.results.failed + uploadSummary.screenshots.failed
          })
          .eq('id', currentRunId);
        console.log('  ✅ Crawl run updated with upload statistics');
      }

      // Clear temp cache after successful upload
      await tempCache.clear();
      console.log('  ✅ Temp cache cleared\n');
    } catch (uploadError) {
      console.error('❌ Batch upload failed:', uploadError);
      logger.error('Batch upload failed', {
        runId: currentRunId,
        error: uploadError.message,
        stack: uploadError.stack
      });
      // Clear cache even on failure to prevent memory leaks
      await tempCache.clear();
    }

    // Step 5: Generate and save summary
    console.log('\n📊 Step 5: Generating summary...\n');
    const summary = generateExecutionSummary(
      properties.length,
      results,
      errors,
      startTime
    );

    await saveSummary(summary, dateStr);

    // Log execution end with summary (AC2, AC3)
    logger.info('='.repeat(60));
    logger.info('Validation execution completed', {
      totalProperties: summary.totalProperties,
      successfulValidations: summary.successfulValidations,
      failedValidations: summary.failedValidations,
      errorCount: summary.errorCount,
      validationRate: summary.validationRate,
      totalExecutionTimeMs: summary.totalExecutionTimeMs,
      averageExecutionTimeMs: summary.averageExecutionTimeMs
    });
    logger.info('='.repeat(60));

    // Broadcast validation completed event
    if (broadcast) {
      broadcast({
        type: 'validation_completed',
        data: {
          summary,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Step 6: Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Properties: ${summary.totalProperties}`);
    console.log(`✅ Successful Validations: ${summary.successfulValidations}`);
    console.log(`❌ Failed Validations: ${summary.failedValidations}`);
    console.log(`⚠️ Errors: ${summary.errorCount}`);
    console.log(`\nValidation Rate: ${summary.validationRate}%`);
    console.log(`Total Execution Time: ${(summary.totalExecutionTimeMs / 1000).toFixed(2)}s`);
    console.log(`Average Time per Property: ${summary.averageExecutionTimeMs.toFixed(0)}ms`);
    console.log('='.repeat(60) + '\n');

    if (summary.issueSummary) {
      console.log('📋 Issues by Type:');
      Object.entries(summary.issueSummary.issuesByType).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count}`);
      });
      console.log('');

      console.log('📋 Issues by Severity:');
      Object.entries(summary.issueSummary.issuesBySeverity).forEach(([severity, count]) => {
        if (count > 0) {
          const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`  ${emoji} ${severity}: ${count}`);
        }
      });
      console.log('');
    }

    return summary;

  } catch (error) {
    // Log fatal errors with stack trace (AC5)
    logger.error('Fatal error during validation execution', {
      error: error.message,
      stack: error.stack,
      executionId,
      csvPath
    });
    console.error('\n❌ Fatal Error:', error.message);
    throw error;

  } finally {
    // Cleanup browser pool
    if (browserPool) {
      await browserPool.cleanup();
    }

    // Ensure temp cache is cleared (in case of errors)
    try {
      await tempCache.clear();
    } catch (clearError) {
      console.error('⚠️ Warning: Failed to clear temp cache:', clearError.message);
    }
  }
}

/**
 * Validate a single property
 *
 * @param {Browser} browser - Playwright browser instance
 * @param {Property} property - Property to validate
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {number} phase - Validation phase (1: fast, 2: slow retry)
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateSingleProperty(browser, property, dateStr, phase = 1, timedOutPropertyIds = null, timeoutMs = null) {
  const url = property.representativeUrl;
  const tempCache = getTempCache();

  // Log property validation start (AC4)
  logger.info(`Property validation started: ${property.propertyName}`, {
    propertyName: property.propertyName,
    measurementId: property.measurementId,
    url
  });

  console.log(`\n📍 ${property.propertyName}`);
  console.log(`   URL: ${url}`);

  // Warn about extremely long URLs that might cause issues
  if (url.length > 500) {
    console.log(`   ⚠️ WARNING: URL length is ${url.length} characters (>500)`);
    console.log(`   This may cause issues with some browsers or storage systems.`);
  }

  // Wrap validation logic with retry (AC3)
  // NOTE: Phase 1 timeouts should NOT retry - they go to Phase 2 immediately
  try {
    const result = await retryWithBackoff(
      async () => {
        let page;
        let context;
        try {
          // Create stealth page with isolated context
          const stealthResult = await createStealthPage(browser);
          context = stealthResult.context;
          page = stealthResult.page;

          // Start network event capture
          const capturedEvents = await startCapturing(page);

          // Navigate to URL
          console.log(`  🌐 Navigating to URL...`);
          const navigationTimeout = timeoutMs || 30000;
          const response = await page.goto(url, {
            timeout: navigationTimeout,
            waitUntil: 'domcontentloaded'  // Changed from 'networkidle' - modern e-commerce sites never reach networkidle
          });

          // Check HTTP status code
          const statusCode = response ? response.status() : null;
          const finalUrl = page.url();
          const redirected = finalUrl !== url;

          console.log(`  📄 HTTP ${statusCode} ${redirected ? `(→ ${finalUrl})` : ''}`);

          // Log warning for error status codes
          if (statusCode && statusCode >= 400) {
            console.log(`  ⚠️ HTTP Error: ${statusCode}`);
          }

          // Simulate comprehensive user interaction to trigger lazy-loaded GTM/GA4 (e.g., INNISFREE-MY)
          // Many sites implement lazy loading GTM that only loads on user interaction
          console.log(`  🖱️ Simulating comprehensive user interaction to trigger lazy-loaded scripts...`);
          try {
            await page.evaluate(() => {
              // 1. Scroll simulation (multiple scroll events)
              window.scrollTo(0, 100);
              window.scrollTo(0, 200);
              window.scrollTo(0, 0);

              // 2. Mouse events (move, click, hover)
              const body = document.body;
              body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
              body.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
              body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));

              // 3. Touch events (for mobile-optimized lazy loading)
              body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }));
              body.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));

              // 4. Focus/visibility events
              window.dispatchEvent(new Event('focus'));
              document.dispatchEvent(new Event('visibilitychange'));

              // 5. Pointer events (modern lazy load detection)
              body.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true }));
              body.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true }));

              // 6. Keyboard interaction (some sites check for keyboard activity)
              body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' }));

              // 7. Trigger Intersection Observer (for lazy loading detection)
              if (window.IntersectionObserver) {
                // Force all observed elements to be considered "in view"
                const observers = window.__intersectionObservers || [];
                observers.forEach(observer => {
                  if (observer.callback) {
                    observer.callback([], observer);
                  }
                });
              }
            });

            // Wait for lazy-loaded scripts to execute
            await page.waitForTimeout(3000); // Increased to 3s for lazy GTM initialization
          } catch (error) {
            console.log(`  ⚠️ Failed to simulate user interaction: ${error.message}`);
          }

          // ==============================================================================
          // Consent Mode Auto-Detection - Story 10.2
          // ==============================================================================
          console.log(`  🍪 Detecting Consent Mode usage...`);
          const hasConsentMode = await detectConsentMode(page);
          console.log(`  ${hasConsentMode ? '✅ Consent Mode DETECTED' : '❌ Consent Mode NOT detected'}`);

          // Update database if detected value differs from current value
          if (property._supabaseId && hasConsentMode !== property.hasConsentMode) {
            try {
              console.log(`  💾 Updating has_consent_mode: ${property.hasConsentMode} → ${hasConsentMode}`);
              const { error: updateError } = await supabase
                .from(Tables.PROPERTIES)
                .update({ has_consent_mode: hasConsentMode })
                .eq('id', property._supabaseId);

              if (updateError) {
                console.error(`  ⚠️ Failed to update Consent Mode in database: ${updateError.message}`);
              } else {
                console.log(`  ✅ Consent Mode updated in database`);
                // Update property object for validation logic
                property.hasConsentMode = hasConsentMode;
              }
            } catch (dbError) {
              console.error(`  ⚠️ Database update error: ${dbError.message}`);
            }
          } else if (hasConsentMode === property.hasConsentMode) {
            console.log(`  ℹ️ Consent Mode matches database value (${hasConsentMode}), no update needed`);
          }

          // ==============================================================================
          // Early Detection: Service Closure & Server Errors
          // ==============================================================================

          // Check for service closure patterns
          console.log(`  🔍 Checking for service closure or critical errors...`);
          const pageCheck = await page.evaluate(() => {
            const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
            const title = document.title.toLowerCase();

            // Service closure patterns (Korean & English)
            const closurePatterns = [
              '서비스가 종료',
              '서비스 종료',
              '서비스를 종료',
              'service has ended',
              'service is closed',
              'no longer available',
              'has been discontinued',
              '서비스를 중단',
              '운영 종료',
              '운영을 종료'
            ];

            // Server error patterns
            const errorPatterns = [
              '502 bad gateway',
              '503 service unavailable',
              '504 gateway timeout',
              'server error',
              '서버 오류'
            ];

            const isServiceClosed = closurePatterns.some(pattern =>
              bodyText.includes(pattern) || title.includes(pattern)
            );

            const hasServerError = errorPatterns.some(pattern =>
              bodyText.includes(pattern) || title.includes(pattern)
            );

            return {
              isServiceClosed,
              hasServerError,
              pageTextSample: bodyText.substring(0, 300)
            };
          });

          // Handle service closure
          if (pageCheck.isServiceClosed) {
            console.log(`  ⚠️ SERVICE CLOSED: Site appears to have ended service`);

            // Create special validation result for closed service
            const closedServiceResult = {
              propertyName: property.propertyName,
              accountName: property.accountName,
              slug: property.slug,
              validationTime: new Date().toISOString(),
              url,
              measurementId: {
                isValid: false,
                expected: property.measurementId,
                actual: null,
                allFound: [],
                issues: [{
                  type: 'SERVICE_CLOSED',
                  severity: 'warning',
                  message: 'Service has been closed or discontinued',
                  expected: property.measurementId,
                  actual: null
                }]
              },
              gtmId: {
                isValid: false,
                expected: property.gtmId,
                actual: null,
                allFound: [],
                issues: [{
                  type: 'SERVICE_CLOSED',
                  severity: 'warning',
                  message: 'Service has been closed or discontinued'
                }]
              },
              pageViewEvent: {
                isValid: false,
                count: 0,
                detectionTimeMs: null,
                timedOut: false,
                issues: [{
                  type: 'SERVICE_CLOSED',
                  severity: 'warning',
                  message: 'Service has been closed or discontinued'
                }]
              },
              apData: { isValid: true, found: false, data: null, issues: [] },
              issues: [{
                type: 'SERVICE_CLOSED',
                severity: 'warning',
                message: 'Service has been closed or discontinued. Remove from CSV or update URL.',
                requiresManualReview: true,
                pageTextSample: pageCheck.pageTextSample
              }],
              isValid: false,
              executionTimeMs: 0,
              pageLoad: {
                statusCode,
                finalUrl,
                redirected,
                requestedUrl: url
              }
            };

            // Wait for page to fully load before taking screenshot
            console.log(`  📸 Waiting for page to fully load before screenshot...`);
            try {
              await page.waitForLoadState('load', { timeout: 10000 });
              console.log(`  ✅ Page fully loaded`);
            } catch (loadError) {
              console.log(`  ⚠️ Load timeout (10s), capturing current state`);
            }

            // Save screenshot for verification
            const screenshotPath = await saveScreenshot(page, property.slug, dateStr);
            closedServiceResult.screenshotPath = screenshotPath;

            return closedServiceResult;
          }

          // Handle server errors with retry suggestion
          if (pageCheck.hasServerError || (statusCode && statusCode >= 500)) {
            console.log(`  ⚠️ SERVER ERROR DETECTED: HTTP ${statusCode} or error page`);

            // Create special validation result for server error
            const serverErrorResult = {
              propertyName: property.propertyName,
              accountName: property.accountName,
              slug: property.slug,
              validationTime: new Date().toISOString(),
              url,
              measurementId: {
                isValid: false,
                expected: property.measurementId,
                actual: null,
                allFound: [],
                issues: [{
                  type: 'SERVER_ERROR',
                  severity: 'critical',
                  message: `Server error detected: HTTP ${statusCode}`,
                  expected: property.measurementId,
                  actual: null
                }]
              },
              gtmId: {
                isValid: false,
                expected: property.gtmId,
                actual: null,
                allFound: [],
                issues: [{
                  type: 'SERVER_ERROR',
                  severity: 'critical',
                  message: `Server error: HTTP ${statusCode}`
                }]
              },
              pageViewEvent: {
                isValid: false,
                count: 0,
                detectionTimeMs: null,
                timedOut: false,
                issues: [{
                  type: 'SERVER_ERROR',
                  severity: 'critical',
                  message: `Server error: HTTP ${statusCode}`
                }]
              },
              apData: { isValid: true, found: false, data: null, issues: [] },
              issues: [{
                type: 'SERVER_ERROR',
                severity: 'critical',
                message: `Server error (HTTP ${statusCode}). Retry validation in 24 hours.`,
                requiresRetry: true,
                statusCode,
                pageTextSample: pageCheck.pageTextSample
              }],
              isValid: false,
              executionTimeMs: 0,
              pageLoad: {
                statusCode,
                finalUrl,
                redirected,
                requestedUrl: url
              }
            };

            // Wait for page to fully load before taking screenshot
            console.log(`  📸 Waiting for page to fully load before screenshot...`);
            try {
              await page.waitForLoadState('load', { timeout: 10000 });
              console.log(`  ✅ Page fully loaded`);
            } catch (loadError) {
              console.log(`  ⚠️ Load timeout (10s), capturing current state`);
            }

            // Save screenshot for debugging
            const screenshotPath = await saveScreenshot(page, property.slug, dateStr);
            serverErrorResult.screenshotPath = screenshotPath;

            return serverErrorResult;
          }

          console.log(`  ✅ No service closure or critical errors detected`);

          // MINIMUM BASELINE: Ensure window.loaded before proceeding
          // Phase 1: Max 20s (fast validation)
          // Phase 2: Max 60s (slow sites, capture fully loaded page)
          const loadTimeout = phase === 1 ? 20000 : 60000;
          console.log(`  ⏳ [Phase ${phase}] Ensuring minimum baseline: waiting for window.loaded (max ${loadTimeout / 1000}s)...`);
          try {
            await page.waitForLoadState('load', { timeout: loadTimeout });
            console.log(`  ✅ Window loaded (baseline guaranteed)`);
          } catch (loadError) {
            console.log(`  ⚠️ Window load timeout (${loadTimeout / 1000}s), proceeding with current state`);
          }

          // Close any popup/modal that might block interaction
          // This handles common newsletter popups, cookie banners, etc.
          console.log(`  🔍 Checking for popups that might block page interaction...`);
          try {
            await page.evaluate(() => {
              // Method 1: Click close button using multiple selector patterns
              const closeSelectors = [
                '[role="dialog"] button[class*="close"]',
                '[role="dialog"] [aria-label*="lose"]',
                '[role="dialog"] .close',
                '.modal-close',
                '.popup-close',
                '[class*="close"][class*="button"]',
                'button[aria-label*="Close"]'
              ];

              let closed = false;
              for (const selector of closeSelectors) {
                const btn = document.querySelector(selector);
                if (btn) {
                  btn.click();
                  console.log(`Closed popup using selector: ${selector}`);
                  closed = true;
                  break;
                }
              }

              // Method 2: Remove modal elements directly
              const modals = document.querySelectorAll('[role="dialog"], .modal, .popup, [class*="newsletter"]');
              if (modals.length > 0) {
                modals.forEach(m => m.remove());
                console.log(`Removed ${modals.length} modal element(s)`);
              }

              // Method 3: Restore page interaction
              const backdrops = document.querySelectorAll('.modal-backdrop, [class*="backdrop"], [class*="overlay"]');
              if (backdrops.length > 0) {
                backdrops.forEach(b => b.remove());
                console.log(`Removed ${backdrops.length} backdrop(s)`);
              }

              // Restore body scroll and position
              document.body.style.overflow = 'auto';
              document.body.style.position = 'static';

              return { closed, modalsRemoved: modals.length, backdropsRemoved: backdrops.length };
            });

            console.log(`  ✅ Popup handling completed`);
            await page.waitForTimeout(1000); // Wait for animations to complete
          } catch (error) {
            console.log(`  ℹ️ Popup handling: ${error.message}`);
          }

          // Trigger lazy loaders with user interactions (scroll, mouse move, clicks)
          // Many sites (like INNISFREE) load GTM only after user interaction
          console.log(`  🖱️ Simulating user interactions to trigger lazy loaders...`);
          try {
            await page.evaluate(() => {
              // Scroll down smoothly to trigger scroll-based lazy loaders
              window.scrollTo({ top: 300, behavior: 'smooth' });
            });
            await page.waitForTimeout(500);

            await page.evaluate(() => {
              // Scroll to middle of page
              const scrollHeight = document.documentElement.scrollHeight;
              window.scrollTo({ top: scrollHeight / 2, behavior: 'smooth' });
            });
            await page.waitForTimeout(500);

            await page.evaluate(() => {
              // Scroll back to top
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            await page.waitForTimeout(500);

            // Mouse movement to trigger interaction-based loaders
            await page.mouse.move(100, 100);
            await page.waitForTimeout(200);
            await page.mouse.move(300, 300);
            await page.waitForTimeout(200);

            // Click on body (safe click that won't navigate)
            await page.evaluate(() => {
              document.body.click();
            });
            await page.waitForTimeout(500);

            console.log(`  ✅ User interaction simulation completed`);
          } catch (error) {
            console.log(`  ℹ️ User interaction simulation: ${error.message}`);
          }

          // Phase 2 Strategy: Take screenshot FIRST (before validation)
          // Reason: Slow sites may have no events or errors, but we need a fully loaded screenshot
          let screenshotBuffer = null;
          if (phase === 2) {
            console.log(`  📸 [Phase 2] Capturing screenshot buffer after window.loaded...`);
            screenshotBuffer = await page.screenshot({
              fullPage: true,
              type: 'jpeg',
              quality: 60
            });
            console.log(`  ✅ Screenshot buffer captured (${(screenshotBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

            // Store in temp cache
            await tempCache.addScreenshot(property._supabaseId || property.slug, screenshotBuffer, {
              propertyName: property.propertyName,
              url: property.representativeUrl,
              phase: 2
            });
          }

          // Story 11.2: Check for Consent Mode Basic BEFORE waiting for events
          // This prevents unnecessary timeout delays for Consent Mode Basic sites
          console.log(`  🔍 Pre-check for Consent Mode Basic indicators...`);
          let hasGTM = false;
          let hasGA4InWindow = false;
          let isConsentModeBasic = false;

          // First check if GTM is loaded (needed for Consent Mode Basic detection)
          if (property.gtmContainerId) {
            const gtmResult = await waitForGTMLoad(page, capturedEvents, property.gtmContainerId, 5000);
            hasGTM = gtmResult.gtmDetected;
            if (gtmResult.gtmDetected) {
              console.log(`  🏷️ GTM detected: ${gtmResult.gtmIds.join(', ')}`);
            }
          }

          // Check window.google_tag_manager for GA4 presence
          if (hasGTM) {
            try {
              const windowCheck = await page.evaluate((expectedGA4Id) => {
              const hasGTMObject = typeof window.google_tag_manager === 'object' && window.google_tag_manager !== null;
              let hasGA4Key = false;

              if (hasGTMObject && expectedGA4Id) {
                // Check if the GA4 ID exists as a key in google_tag_manager
                hasGA4Key = window.google_tag_manager.hasOwnProperty(expectedGA4Id);
              }

              return {
                hasGTMObject,
                hasGA4Key,
                gtmKeys: hasGTMObject ? Object.keys(window.google_tag_manager).slice(0, 10) : []
              };
            }, property.measurementId);

            hasGTM = hasGTM || windowCheck.hasGTMObject;
            hasGA4InWindow = windowCheck.hasGA4Key;

            console.log(`  📊 Window detection: GTM=${windowCheck.hasGTMObject}, GA4 in window=${hasGA4InWindow}`);
            if (windowCheck.hasGTMObject) {
              console.log(`  🔑 GTM keys found: ${windowCheck.gtmKeys.join(', ')}`);
            }

            // Check if this is Consent Mode Basic (GTM present but GA4 not in window)
            if (windowCheck.hasGTMObject && !hasGA4InWindow) {
              console.log(`  🍪 Possible Consent Mode Basic detected (GTM without GA4 in window)`);
              isConsentModeBasic = true;
            }
          } catch (error) {
            console.log(`  ⚠️ Window detection error: ${error.message}`);
          }
        }

        // Wait for GA4 events - but skip if Consent Mode Basic is detected
        let events = [];
        let timing = {};

        if (isConsentModeBasic) {
          console.log(`  ⏭️ Skipping GA4 event wait due to Consent Mode Basic detection`);
          events = capturedEvents; // Use whatever was captured so far
          timing = { detectionTimeMs: 0, timedOut: false, skipped: true };
        } else {
          // Normal flow - wait for GA4 events
          const eventResult = await waitForGA4Events(page, capturedEvents, property.measurementId);
          events = eventResult.events;
          timing = eventResult.timing;
        }

        // Prepare context for validation
        const validationContext = {
          hasGTM,
          hasGA4InWindow,
          networkEvents: events,
          expectedGA4Id: property.measurementId
        };

        // Validate configuration (Story 3.5: Pass page for AP_DATA extraction)
        // Story 11.2: Pass context for Consent Mode Basic detection
        const result = await validateProperty(property, events, url, page, timing, validationContext);

          // Add page load information
          result.pageLoad = {
            statusCode,
            finalUrl,
            redirected,
            requestedUrl: url
          };

          // Phase 1 Strategy: Take screenshot AFTER validation
          // Reason: Fast sites complete quickly, screenshot right before queue move
          if (phase === 1) {
            console.log(`  📸 [Phase 1] Capturing screenshot buffer after validation...`);
            screenshotBuffer = await page.screenshot({
              fullPage: true,
              type: 'jpeg',
              quality: 60
            });
            console.log(`  ✅ Screenshot buffer captured (${(screenshotBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

            // Store in temp cache
            await tempCache.addScreenshot(property._supabaseId || property.slug, screenshotBuffer, {
              propertyName: property.propertyName,
              url: property.representativeUrl,
              phase: 1
            });
          }

          // Add phase info to result
          result.phase = phase;

          return result;

        } finally {
          // Close page and context to properly clean up browser resources
          try {
            if (page) {
              await page.close();
            }
          } catch (error) {
            // Ignore errors when closing page (already closed is fine)
          }

          try {
            if (context) {
              await context.close();
            }
          } catch (error) {
            // Ignore errors when closing context (already closed is fine)
          }
        }
      },
      3, // maxRetries
      1000, // baseBackoffMs (1 second)
      property.propertyName, // context for logging
      phase // current phase (prevents Phase 1 timeout retries)
    );

    // Save validation result to local files (optional backup)
    if (process.env.LOCAL_BACKUP_ENABLED === 'true') {
      await saveValidationResult(result, dateStr);
    }

    // Store result in temp cache (will be batch uploaded later)
    // BUT: Skip storage if this property timed out in Phase 1 (race condition prevention)
    const propertyId = property._supabaseId || property.slug;

    if (timedOutPropertyIds && timedOutPropertyIds.has(propertyId) && phase === 1) {
      console.log(`  ⏭️ Skipping cache storage - property ${propertyId} already timed out and queued for Phase 2`);
    } else {
      console.log(`  💾 Storing result in temp cache for ${property.propertyName}...`);
      console.log(`     propertyId: ${propertyId} (${property._supabaseId ? 'UUID' : 'slug fallback'})`);

      try {
        await tempCache.addResult(result, propertyId);
        console.log(`  ✅ Result stored in cache`);
      } catch (cacheError) {
        console.error(`  ❌ Failed to store result in cache for ${property.propertyName}:`, cacheError.message);
        logger.error('Cache storage failed', {
          propertyName: property.propertyName,
          propertyId,
          error: cacheError.message,
          phase
        });
      }
    }

    // Log property validation end (AC4)
    logger.info(`Property validation completed: ${property.propertyName}`, {
      propertyName: property.propertyName,
      isValid: result.isValid,
      issueCount: result.issues?.length || 0,
      executionTimeMs: result.executionTimeMs
    });

    return result;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);

    // Log property validation error (AC5)
    logger.error(`Property validation failed: ${property.propertyName}`, {
      propertyName: property.propertyName,
      error: error.message,
      stack: error.stack,
      url
    });

    // Create error result (AC3 - after all retries exhausted)
    const errorResult = {
      propertyName: property.propertyName,
      accountName: property.accountName,
      slug: property.slug,
      validationTime: new Date().toISOString(),
      url,
      isValid: false,
      error: error.message,
      issues: [{
        type: 'VALIDATION_ERROR',
        severity: 'critical',
        message: `Validation failed after retries: ${error.message}`
      }],
      executionTimeMs: 0
    };

    // Save error result to local files (optional backup)
    if (process.env.LOCAL_BACKUP_ENABLED === 'true') {
      await saveValidationResult(errorResult, dateStr);
    }

    // Store error result in temp cache (will be batch uploaded later)
    const errorPropertyId = property._supabaseId || property.slug;
    console.log(`  💾 Storing error result in temp cache for ${property.propertyName}...`);
    console.log(`     propertyId: ${errorPropertyId} (${property._supabaseId ? 'UUID' : 'slug fallback'})`);

    try {
      await tempCache.addResult(errorResult, errorPropertyId);
      console.log(`  ✅ Error result stored in cache`);
    } catch (cacheError) {
      console.error(`  ❌ Failed to store error result in cache for ${property.propertyName}:`, cacheError.message);
      logger.error('Error result cache storage failed', {
        propertyName: property.propertyName,
        propertyId: errorPropertyId,
        error: cacheError.message,
        validationError: error.message
      });
    }

    // Re-throw the error so orchestrator can handle Phase 1 timeout queueing
    throw error;
  }
}

/**
 * Generate execution summary
 *
 * @param {number} totalProperties - Total number of properties
 * @param {Array<ValidationResult>} results - Validation results
 * @param {Array} errors - Validation errors
 * @param {number} startTime - Execution start time
 * @returns {Object} Execution summary
 */
function generateExecutionSummary(totalProperties, results, errors, startTime) {
  const executionTimeMs = Date.now() - startTime;

  const successfulValidations = results.filter(r => r.isValid).length;
  const failedValidations = results.filter(r => !r.isValid).length;

  const averageExecutionTimeMs = results.length > 0
    ? results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / results.length
    : 0;

  const issueSummary = results.length > 0
    ? generateIssueSummary(results)
    : null;

  // Reset current run ID
  currentRunId = null;

  return {
    executionTime: new Date().toISOString(),
    totalProperties,
    successfulValidations,
    failedValidations,
    errorCount: errors.length,
    validationRate: ((successfulValidations / totalProperties) * 100).toFixed(1),
    totalExecutionTimeMs: executionTimeMs,
    averageExecutionTimeMs,
    issueSummary,
    errors: errors.map(e => ({
      propertyName: e.property.propertyName,
      error: e.error
    })),
    wasCancelled: shouldStop  // Include cancellation status for proper status handling
  };
}

// Export retry functions for testing (Story 6.1)
export { retryWithBackoff, isRetryableError };

export default {
  runValidation
};
