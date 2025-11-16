/**
 * Cron Job Entry Point
 *
 * Main entry point for scheduled cron job execution
 * Orchestrates daily GA4 property validation with lock mechanism
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.4: Cron Job Automation
 */

import { acquireLock, releaseLock, setupLockCleanup, getLockPid } from './modules/lockManager.js';
import { logCronStart, logCronComplete, logCronError, logCronSkipped } from './modules/cronLogger.js';
import { BrowserPool } from './modules/browserPoolManager.js';
import { loadPropertiesFromCSV } from './modules/csvPropertyManager.js';
import { runParallelValidation } from './modules/orchestrator.js';
import path from 'path';

/**
 * Main cron job execution function
 * Implements all acceptance criteria for Story 2.4
 */
async function main() {
  const startTime = Date.now();

  try {
    // AC5: Check for lock and prevent concurrent execution
    const lockAcquired = await acquireLock();

    if (!lockAcquired) {
      const existingPid = getLockPid();
      logCronSkipped(existingPid);
      process.exit(0); // Exit gracefully, not an error
    }

    // Setup cleanup handlers (AC3, AC5)
    setupLockCleanup();

    // Load properties from CSV
    const csvPath = path.join(process.cwd(), 'data', 'properties.csv');
    const properties = await loadPropertiesFromCSV(csvPath);

    // Get browser pool size from environment or use default
    const browserPoolSize = parseInt(process.env.BROWSER_POOL_SIZE || '5', 10);

    // AC4: Log cron job start
    logCronStart({
      propertyCount: properties.length,
      browserPoolSize
    });

    // Initialize browser pool
    const browserPool = new BrowserPool(browserPoolSize);
    await browserPool.initialize();

    try {
      // Get today's date for validation
      const today = new Date().toISOString().split('T')[0];

      // Run parallel validation
      const result = await runParallelValidation(browserPool, properties, today);

      const executionTimeMs = Date.now() - startTime;

      // AC4: Log successful completion
      logCronComplete({
        executionTimeMs,
        successCount: result.results.length,
        errorCount: result.errors.length,
        totalCount: properties.length,
        averageTimePerProperty: (executionTimeMs / properties.length).toFixed(2)
      });

      // AC5: Release lock after successful completion
      await releaseLock();

      process.exit(0);
    } finally {
      // Always cleanup browser pool
      await browserPool.cleanup();
    }
  } catch (error) {
    // AC3: Log error with full context
    logCronError(error, {
      executionTimeMs: Date.now() - startTime,
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd()
    });

    // AC5: Release lock on error
    await releaseLock();

    process.exit(1);
  }
}

// Execute main function
main().catch((error) => {
  console.error('Fatal error in cron job:', error);
  process.exit(1);
});
