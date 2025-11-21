/**
 * Crawl Queue Consumer
 *
 * Polls crawl_request_queue and executes pending requests.
 * Only runs in local environment where browser automation is available.
 *
 * Architecture:
 * 1. Poll queue every 10 seconds for pending requests
 * 2. Claim oldest pending request (mark as processing)
 * 3. Create crawl_run and execute validation
 * 4. Update queue status (completed/failed)
 * 5. Retry failed requests with exponential backoff
 */

import { supabase, Tables, CrawlRunStatus } from '../utils/supabase.js';
import { runValidation } from './orchestrator.js';
import { getCrawlState } from '../routes/crawl.js';
import { isCrawlDisabled } from '../utils/environment.js';
import logger from '../utils/logger.js';
import os from 'os';

const POLL_INTERVAL_MS = 10000; // 10 seconds
const WORKER_ID = `worker-${os.hostname()}-${process.pid}-${Date.now()}`;

let isRunning = false;
let pollTimer = null;

/**
 * Start queue consumer (only in local environment)
 */
export async function startQueueConsumer() {
  if (isCrawlDisabled()) {
    console.log('⏸️  Crawl queue consumer disabled (queue-only mode, no execution)');
    logger.info('Queue consumer disabled - queue-only mode', { reason: 'isCrawlDisabled' });
    return;
  }

  if (isRunning) {
    console.log('⚠️  Queue consumer already running');
    logger.warn('Attempted to start queue consumer but already running');
    return;
  }

  isRunning = true;
  console.log(`\n🚀 Crawl queue consumer started`);
  console.log(`   Worker ID: ${WORKER_ID}`);
  console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms (${POLL_INTERVAL_MS / 1000}s)`);
  logger.info('Queue consumer started', {
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    hostname: os.hostname(),
    pid: process.pid
  });

  // Start polling loop
  pollQueue();
}

/**
 * Stop queue consumer gracefully
 */
export function stopQueueConsumer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  isRunning = false;
  console.log('🛑 Queue consumer stopped');
  logger.info('Queue consumer stopped', { workerId: WORKER_ID });
}

/**
 * Poll queue for pending requests
 * Runs continuously with configurable interval
 */
async function pollQueue() {
  if (!isRunning) {
    return; // Consumer stopped, exit polling loop
  }

  try {
    // Check if a crawl is already running
    const crawlState = getCrawlState();
    if (crawlState.isRunning) {
      logger.debug('Skipping queue poll - crawl already in progress');
      // Schedule next poll and exit
      pollTimer = setTimeout(pollQueue, POLL_INTERVAL_MS);
      return;
    }

    // Fetch oldest pending request with FOR UPDATE SKIP LOCKED pattern
    // This prevents multiple workers from claiming the same request
    const { data: request, error } = await supabase
      .from('crawl_request_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned (queue empty) - this is normal, not an error
        logger.debug('Queue poll: No pending requests');
      } else {
        // Actual error occurred
        logger.error('Queue polling error', { error: error.message, code: error.code });
      }
    } else if (request) {
      // Found a pending request - process it
      await processRequest(request);
    }
  } catch (error) {
    console.error('❌ Queue polling exception:', error.message);
    logger.error('Queue polling exception', {
      error: error.message,
      stack: error.stack
    });
  }

  // Schedule next poll
  pollTimer = setTimeout(pollQueue, POLL_INTERVAL_MS);
}

/**
 * Process a single queue request
 * Claims request, executes crawl, updates status
 *
 * @param {Object} request - Queue request object from database
 */
async function processRequest(request) {
  console.log(`\n📥 Processing queue request ${request.id}`);
  console.log(`   Requested by: ${request.requested_by}`);
  console.log(`   Created: ${new Date(request.created_at).toLocaleString()}`);
  console.log(`   Browser pool size: ${request.browser_pool_size}`);

  logger.info('Processing queue request', {
    requestId: request.id,
    requestedBy: request.requested_by,
    requestSource: request.request_source,
    browserPoolSize: request.browser_pool_size,
    propertyIds: request.property_ids,
    createdAt: request.created_at
  });

  try {
    // Step 1: Claim the request (mark as processing)
    const { error: claimError } = await supabase
      .from('crawl_request_queue')
      .update({
        status: 'processing',
        assigned_worker: WORKER_ID,
        started_processing_at: new Date().toISOString()
      })
      .eq('id', request.id)
      .eq('status', 'pending'); // Only update if still pending (race condition protection)

    if (claimError) {
      logger.error('Failed to claim queue request', {
        requestId: request.id,
        error: claimError.message
      });
      return; // Another worker may have claimed it
    }

    console.log(`✓ Request claimed by ${WORKER_ID}`);

    // Step 2: Fetch properties to crawl
    const properties = await getPropertiesToCrawl(request.property_ids);

    if (!properties || properties.length === 0) {
      throw new Error('No active properties found to crawl');
    }

    console.log(`✓ Found ${properties.length} properties to crawl`);

    // Step 3: Create crawl_run record
    const { data: crawlRun, error: runError } = await supabase
      .from(Tables.CRAWL_RUNS)
      .insert({
        run_date: new Date().toISOString().split('T')[0],
        status: CrawlRunStatus.RUNNING,
        browser_pool_size: request.browser_pool_size || 7,
        total_properties: properties.length
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create crawl_run: ${runError.message}`);
    }

    console.log(`✓ Created crawl_run ${crawlRun.id}`);

    // Step 4: Link queue request to crawl run
    await supabase
      .from('crawl_request_queue')
      .update({ crawl_run_id: crawlRun.id })
      .eq('id', request.id);

    // Step 5: Execute crawl (using existing orchestrator)
    logger.info('Starting crawl execution', {
      requestId: request.id,
      crawlRunId: crawlRun.id,
      propertyCount: properties.length
    });

    const summary = await runValidation({
      csvPath: null, // No CSV, using Supabase properties
      browserPoolSize: request.browser_pool_size || 7,
      runId: crawlRun.id,
      properties: properties
    });

    // Step 6: Mark as completed
    await supabase
      .from('crawl_request_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', request.id);

    console.log(`✅ Queue request ${request.id} completed successfully`);
    console.log(`   Crawl run: ${crawlRun.id}`);
    console.log(`   Total properties: ${summary.totalProperties || properties.length}`);
    console.log(`   Successful: ${summary.successfulValidations || 0}`);
    console.log(`   Failed: ${summary.failedValidations || 0}`);

    logger.info('Queue request completed', {
      requestId: request.id,
      crawlRunId: crawlRun.id,
      summary: summary
    });

  } catch (error) {
    console.error(`❌ Queue request ${request.id} failed:`, error.message);

    logger.error('Queue request failed', {
      requestId: request.id,
      error: error.message,
      stack: error.stack
    });

    // Determine if should retry
    const newRetryCount = (request.retry_count || 0) + 1;
    const maxRetries = request.max_retries || 3;
    const shouldRetry = newRetryCount < maxRetries;

    await supabase
      .from('crawl_request_queue')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        error_message: error.message,
        retry_count: newRetryCount,
        completed_at: shouldRetry ? null : new Date().toISOString(),
        assigned_worker: shouldRetry ? null : WORKER_ID // Clear assignment if retrying
      })
      .eq('id', request.id);

    if (shouldRetry) {
      console.log(`⚠️  Request ${request.id} will be retried (attempt ${newRetryCount}/${maxRetries})`);
      logger.info('Queue request will be retried', {
        requestId: request.id,
        retryCount: newRetryCount,
        maxRetries: maxRetries
      });
    } else {
      console.log(`💔 Request ${request.id} permanently failed after ${maxRetries} attempts`);
      logger.error('Queue request permanently failed', {
        requestId: request.id,
        retryCount: newRetryCount,
        maxRetries: maxRetries,
        finalError: error.message
      });
    }
  }
}

/**
 * Get properties to crawl based on queue request
 *
 * @param {Array<string>|null} propertyIds - Optional array of property IDs to filter
 * @returns {Promise<Array>} Array of property objects in orchestrator format
 */
async function getPropertiesToCrawl(propertyIds) {
  let query = supabase
    .from(Tables.PROPERTIES)
    .select('*')
    .eq('is_active', true)
    .order('property_name', { ascending: true });

  // Filter by specific property IDs if provided
  if (propertyIds && propertyIds.length > 0) {
    query = query.in('id', propertyIds);
  }

  const { data: properties, error } = await query;

  if (error) {
    logger.error('Failed to fetch properties from Supabase', { error: error.message });
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  // Transform Supabase properties to orchestrator format
  return properties.map(prop => ({
    propertyName: prop.property_name,
    measurementId: prop.expected_ga4_id,
    gtmContainerId: prop.expected_gtm_id,
    representativeUrl: prop.url,
    slug: prop.slug,
    _supabaseId: prop.id
  }));
}

/**
 * Get queue statistics (for monitoring)
 *
 * @returns {Promise<Object>} Queue status summary
 */
export async function getQueueStats() {
  try {
    const { data: items, error } = await supabase
      .from('crawl_request_queue')
      .select('status, created_at');

    if (error) {
      throw error;
    }

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: items.length
    };

    items.forEach(item => {
      if (stats.hasOwnProperty(item.status)) {
        stats[item.status]++;
      }
    });

    // Add oldest pending request age
    const pendingItems = items.filter(item => item.status === 'pending');
    if (pendingItems.length > 0) {
      const oldestPending = pendingItems.reduce((oldest, item) => {
        const itemDate = new Date(item.created_at);
        const oldestDate = new Date(oldest.created_at);
        return itemDate < oldestDate ? item : oldest;
      });

      const age = Date.now() - new Date(oldestPending.created_at).getTime();
      stats.oldestPendingAgeMs = age;
      stats.oldestPendingAgeMinutes = Math.floor(age / 60000);
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
      error: error.message
    };
  }
}

/**
 * Manually process next pending request (for debugging/testing)
 *
 * @returns {Promise<boolean>} True if request was processed, false if queue empty
 */
export async function processNextRequest() {
  if (!isRunning) {
    throw new Error('Queue consumer is not running');
  }

  const crawlState = getCrawlState();
  if (crawlState.isRunning) {
    throw new Error('Crawl already in progress');
  }

  const { data: request, error } = await supabase
    .from('crawl_request_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false; // Queue empty
    }
    throw new Error(`Failed to fetch pending request: ${error.message}`);
  }

  await processRequest(request);
  return true;
}
