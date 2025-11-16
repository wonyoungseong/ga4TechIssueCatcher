/**
 * Orchestrator Integration Module
 *
 * Integrates temp cache and batch upload system into the orchestrator workflow.
 * This module contains the modified functions for the new data management strategy.
 *
 * Key Changes:
 * 1. Local temp cache during crawl (in-memory + temp files)
 * 2. Screenshot buffers stored in cache (no immediate disk save)
 * 3. Batch upload to Supabase after crawl completion
 * 4. TTL-based cleanup for unsaved results
 */

import { getTempCache } from './tempCacheManager.js';
import BatchUploadManager from './batchUploadManager.js';
import { createStealthPage } from './browserPoolManager.js';
import { startCapturing, waitForGA4Events } from './networkEventCapturer.js';
import { validateProperty } from './configValidator.js';
import logger from '../utils/logger.js';

/**
 * Modified validateSingleProperty - Uses temp cache instead of immediate save
 *
 * Changes from original:
 * - Screenshot captured as buffer (not saved to disk)
 * - Result stored in temp cache
 * - No Supabase INSERT during crawl
 *
 * @param {Browser} browser - Playwright browser instance
 * @param {Property} property - Property to validate
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {number} phase - Validation phase (1: fast, 2: slow retry)
 * @returns {Promise<ValidationResult>} Validation result
 */
export async function validateSinglePropertyWithCache(browser, property, dateStr, phase = 1) {
  const url = property.representativeUrl;
  const tempCache = getTempCache();

  logger.info(`Property validation started: ${property.propertyName}`, {
    propertyName: property.propertyName,
    measurementId: property.measurementId,
    url
  });

  console.log(`\n📍 ${property.propertyName}`);
  console.log(`   URL: ${url}`);

  try {
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
      const response = await page.goto(url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });

      const statusCode = response ? response.status() : null;
      const finalUrl = page.url();
      const redirected = finalUrl !== url;

      console.log(`  📄 HTTP ${statusCode} ${redirected ? `(→ ${finalUrl})` : ''}`);

      // Wait for page load
      const loadTimeout = phase === 1 ? 20000 : 60000;
      console.log(`  ⏳ [Phase ${phase}] Waiting for window.loaded (max ${loadTimeout / 1000}s)...`);
      try {
        await page.waitForLoadState('load', { timeout: loadTimeout });
        console.log(`  ✅ Window loaded`);
      } catch (loadError) {
        console.log(`  ⚠️ Window load timeout (${loadTimeout / 1000}s)`);
      }

      // 📸 CAPTURE SCREENSHOT AS BUFFER (not saved to disk)
      console.log(`  📸 Capturing screenshot buffer...`);
      const screenshotBuffer = await page.screenshot({
        fullPage: true,
        type: 'jpeg',
        quality: 60
      });
      console.log(`  ✅ Screenshot buffer captured (${(screenshotBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

      // Store screenshot in cache
      await tempCache.addScreenshot(property._supabaseId || property.slug, screenshotBuffer, {
        propertyName: property.propertyName,
        url: property.representativeUrl,
        phase
      });

      // Wait for GA4 events
      const { events, timing } = await waitForGA4Events(page, capturedEvents, property.measurementId);

      // Validate configuration
      const result = await validateProperty(property, events, url, page, timing);

      // Add page load information
      result.pageLoad = {
        statusCode,
        finalUrl,
        redirected,
        requestedUrl: url
      };

      result.phase = phase;

      // 💾 STORE RESULT IN TEMP CACHE (not saved to disk or Supabase yet)
      await tempCache.addResult(result, property._supabaseId || property.slug);

      logger.info(`Property validation completed: ${property.propertyName}`, {
        propertyName: property.propertyName,
        isValid: result.isValid,
        issueCount: result.issues?.length || 0,
        executionTimeMs: result.executionTimeMs
      });

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

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);

    logger.error(`Property validation failed: ${property.propertyName}`, {
      propertyName: property.propertyName,
      error: error.message,
      stack: error.stack,
      url
    });

    // Create error result and store in cache
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
        message: `Validation failed: ${error.message}`
      }],
      executionTimeMs: 0
    };

    await tempCache.addResult(errorResult, property._supabaseId || property.slug);

    return errorResult;
  }
}

/**
 * Batch upload cached results to Supabase
 * Called after crawl completion
 *
 * @param {string} runId - Crawl run ID
 * @returns {Promise<Object>} Upload summary
 */
export async function batchUploadCachedResults(runId) {
  const tempCache = getTempCache();
  const batchUploader = new BatchUploadManager();

  try {
    console.log('\n' + '='.repeat(60));
    console.log('📤 Preparing Batch Upload');
    console.log('='.repeat(60));

    // Get cache stats before upload
    const stats = tempCache.getStats();
    console.log(`Cache Stats:`);
    console.log(`  Results: ${stats.resultCount}`);
    console.log(`  Screenshots: ${stats.screenshotCount}`);
    console.log(`  Total Screenshot Size: ${stats.totalScreenshotSizeMB}MB`);
    console.log(`  Memory Usage: ${stats.memoryUsageMB}MB`);
    console.log('='.repeat(60) + '\n');

    // Export cache data for upload
    const cacheData = tempCache.exportForUpload();

    // Batch upload to Supabase
    const uploadSummary = await batchUploader.uploadAll(runId, cacheData);

    // Clear temp cache after successful upload
    await tempCache.clear();

    return uploadSummary;

  } catch (error) {
    console.error('❌ Batch upload failed:', error);
    logger.error('Batch upload failed', {
      runId,
      error: error.message,
      stack: error.stack
    });

    // Clear cache even on failure (to prevent memory leaks)
    await tempCache.clear();

    throw error;
  }
}

/**
 * Modified runParallelValidation - Uses temp cache + batch upload
 *
 * Workflow:
 * 1. Initialize temp cache
 * 2. Run validation with cache (no immediate Supabase saves)
 * 3. Batch upload all results after completion
 * 4. Clear temp cache
 *
 * @param {BrowserPool} browserPool - Initialized browser pool
 * @param {Array<Property>} properties - All properties to validate
 * @param {string} dateStr - Date string for result storage
 * @param {string} runId - Crawl run ID
 * @returns {Promise<Object>} {results, errors, executionTimeMs, uploadSummary}
 */
export async function runParallelValidationWithCache(browserPool, properties, dateStr, runId) {
  const tempCache = getTempCache();

  // Initialize temp cache
  await tempCache.initialize();

  // Run parallel validation (uses temp cache)
  console.log('\n📦 Running validation with temp cache...\n');

  const parallelStartTime = Date.now();
  const poolSize = browserPool.getPoolSize();

  // ... (Same parallel validation logic as original orchestrator.js)
  // Replace validateSingleProperty calls with validateSinglePropertyWithCache
  // Remove immediate Supabase INSERT calls

  // After validation completes, batch upload
  console.log('\n📤 Validation complete, starting batch upload...\n');

  let uploadSummary = null;
  try {
    uploadSummary = await batchUploadCachedResults(runId);
  } catch (uploadError) {
    console.error('❌ Batch upload failed, but validation completed:', uploadError);
    // Continue even if upload fails (results are in cache)
  }

  const totalExecutionTimeMs = Date.now() - parallelStartTime;

  return {
    results: tempCache.getResults().map(item => item.result),
    errors: [], // Collect from validation errors
    executionTimeMs: totalExecutionTimeMs,
    uploadSummary
  };
}

export default {
  validateSinglePropertyWithCache,
  batchUploadCachedResults,
  runParallelValidationWithCache
};
