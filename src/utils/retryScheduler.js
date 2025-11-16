/**
 * Retry Queue Scheduler
 *
 * Automated scheduler for processing retry queue at regular intervals
 * Uses cron job to check for pending retries every 15 minutes
 *
 * Story 10.3: Network Error Retry Queue System - Phase 2
 */

import cron from 'node-cron';
import { BrowserPool } from '../modules/browserPoolManager.js';
import { processRetryQueue } from '../modules/retryQueue.js';
import logger from './logger.js';

class RetryScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.isProcessing = false;
    this.schedule = process.env.RETRY_QUEUE_SCHEDULE || '*/15 * * * *'; // Every 15 minutes by default
    this.enabled = process.env.RETRY_QUEUE_ENABLED !== 'false'; // Enabled by default
  }

  /**
   * Start the retry queue scheduler
   */
  start() {
    if (!this.enabled) {
      console.log('⏸️  Retry queue scheduler is disabled (RETRY_QUEUE_ENABLED=false)');
      logger.info('Retry queue scheduler disabled');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️  Retry queue scheduler is already running');
      return;
    }

    // Validate cron expression
    if (!cron.validate(this.schedule)) {
      console.error(`❌ Invalid cron schedule: ${this.schedule}`);
      logger.error('Invalid retry queue cron schedule', { schedule: this.schedule });
      return;
    }

    console.log(`\n🕐 Starting retry queue scheduler...`);
    console.log(`   Schedule: ${this.schedule} (${this.getCronDescription()})`);
    logger.info('Starting retry queue scheduler', { schedule: this.schedule });

    // Create cron job
    this.cronJob = cron.schedule(this.schedule, async () => {
      await this.processQueue();
    });

    this.isRunning = true;
    console.log('✅ Retry queue scheduler started\n');
  }

  /**
   * Stop the retry queue scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Retry queue scheduler is not running');
      return;
    }

    console.log('🛑 Stopping retry queue scheduler...');
    logger.info('Stopping retry queue scheduler');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    console.log('✅ Retry queue scheduler stopped');
  }

  /**
   * Process retry queue
   * @private
   */
  async processQueue() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('⏳ Retry queue processing already in progress, skipping...');
      logger.info('Retry queue processing skipped - already in progress');
      return;
    }

    this.isProcessing = true;
    let browserPool = null;

    try {
      console.log('\n🔄 Scheduled retry queue processing triggered');
      logger.info('Scheduled retry queue processing started');

      // Initialize browser pool
      browserPool = new BrowserPool();
      await browserPool.initialize();

      // Generate date string for results (YYYYMMDD)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

      // Process retry queue
      const stats = await processRetryQueue(browserPool.browsers[0], dateStr);

      console.log('✅ Scheduled retry queue processing completed');
      logger.info('Scheduled retry queue processing completed', stats);

      // Clean up browser pool
      await browserPool.close();
    } catch (error) {
      console.error('❌ Scheduled retry queue processing failed:', error.message);
      logger.error('Scheduled retry queue processing failed', {
        error: error.message,
        stack: error.stack
      });

      // Clean up browser pool on error
      if (browserPool) {
        try {
          await browserPool.close();
        } catch (cleanupError) {
          console.error('⚠️  Browser pool cleanup failed:', cleanupError.message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get human-readable description of cron schedule
   * @private
   */
  getCronDescription() {
    const schedules = {
      '*/15 * * * *': 'Every 15 minutes',
      '*/30 * * * *': 'Every 30 minutes',
      '0 * * * *': 'Every hour',
      '0 */2 * * *': 'Every 2 hours',
      '0 */6 * * *': 'Every 6 hours',
      '0 0 * * *': 'Daily at midnight'
    };

    return schedules[this.schedule] || 'Custom schedule';
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      schedule: this.schedule,
      description: this.getCronDescription()
    };
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get retry scheduler instance (singleton)
 */
export function getRetryScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new RetryScheduler();
  }
  return schedulerInstance;
}

export default getRetryScheduler;
