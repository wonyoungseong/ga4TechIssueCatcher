/**
 * Automatic Cleanup Scheduler
 *
 * Schedules automatic data lifecycle cleanup using node-cron.
 * Configuration stored in Supabase cleanup_settings table.
 */

import cron from 'node-cron';
import DataLifecycleManager from '../modules/dataLifecycleManager.js';
import logger from './logger.js';
import { supabase } from './supabase.js';

class CleanupScheduler {
  constructor() {
    this.lifecycleManager = new DataLifecycleManager();
    this.cronJob = null;
    this.isEnabled = false;
    this.cronExpression = '0 3 * * *'; // Default: 3 AM daily
    this.timezone = 'Asia/Seoul'; // Default timezone
    this.lastRun = null;
    this.nextRun = null;
    this.settingsLoaded = false;
  }

  /**
   * Load scheduler settings from database
   * @returns {Promise<Object>} Settings object
   */
  async loadSettings() {
    try {
      const { data, error } = await supabase
        .from('cleanup_settings')
        .select('*')
        .single();

      if (error) {
        // If table doesn't exist or no settings found, use defaults
        if (error.code === 'PGRST116' || error.code === '42P01') {
          logger.warn('Cleanup settings not found, using defaults', {
            code: error.code,
            message: error.message
          });
          return this.getDefaultSettings();
        }
        throw error;
      }

      if (data) {
        this.cronExpression = data.cron_expression || '0 3 * * *';
        this.timezone = data.timezone || 'Asia/Seoul';
        this.isEnabled = data.is_enabled !== false; // Default to true

        // Update lifecycle manager settings if they exist
        if (data.unsaved_crawl_ttl_days) {
          this.lifecycleManager.UNSAVED_CRAWL_TTL_DAYS = data.unsaved_crawl_ttl_days;
        }
        if (data.screenshot_ttl_days) {
          this.lifecycleManager.SCREENSHOT_TTL_DAYS = data.screenshot_ttl_days;
        }
        if (data.batch_size) {
          this.lifecycleManager.CLEANUP_BATCH_SIZE = data.batch_size;
        }

        this.settingsLoaded = true;

        logger.info('Cleanup settings loaded from database', {
          cronExpression: this.cronExpression,
          timezone: this.timezone,
          isEnabled: this.isEnabled
        });

        return data;
      }

      return this.getDefaultSettings();
    } catch (error) {
      logger.error('Failed to load cleanup settings from database', {
        error: error.message,
        stack: error.stack
      });
      return this.getDefaultSettings();
    }
  }

  /**
   * Get default settings (fallback)
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return {
      cron_expression: '0 3 * * *',
      timezone: 'Asia/Seoul',
      is_enabled: true,
      unsaved_crawl_ttl_days: 30,
      screenshot_ttl_days: 30,
      batch_size: 100
    };
  }

  /**
   * Start automatic cleanup scheduler
   *
   * @param {string} cronExpression - Cron expression (optional, will override database settings)
   */
  async start(cronExpression = null) {
    if (this.isEnabled && this.cronJob) {
      console.log('⚠️ Cleanup scheduler is already running');
      return;
    }

    // Load settings from database if not already loaded
    if (!this.settingsLoaded) {
      await this.loadSettings();
    }

    // Use provided expression or loaded expression
    const expression = cronExpression || this.cronExpression;

    // Validate cron expression
    if (!cron.validate(expression)) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('⏰ Starting Automatic Cleanup Scheduler');
    console.log('='.repeat(60));
    console.log(`Cron Expression: ${expression}`);
    console.log(`Timezone: ${this.timezone}`);
    console.log('='.repeat(60) + '\n');

    // Schedule cleanup task
    this.cronJob = cron.schedule(expression, async () => {
      console.log('\n🕐 Scheduled cleanup triggered');
      await this.runScheduledCleanup();
    }, {
      scheduled: true,
      timezone: this.timezone
    });

    this.isEnabled = true;
    this.cronExpression = expression;
    this.updateNextRun();

    logger.info('Cleanup scheduler started', {
      cronExpression: expression,
      timezone: this.timezone,
      nextRun: this.nextRun
    });

    console.log(`✅ Cleanup scheduler started`);
    console.log(`   Next run: ${this.nextRun?.toLocaleString()}\n`);
  }

  /**
   * Stop automatic cleanup scheduler
   */
  stop() {
    if (!this.isEnabled) {
      console.log('⚠️ Cleanup scheduler is not running');
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isEnabled = false;
    this.nextRun = null;

    logger.info('Cleanup scheduler stopped');
    console.log('✅ Cleanup scheduler stopped\n');
  }

  /**
   * Run scheduled cleanup task
   */
  async runScheduledCleanup() {
    const startTime = Date.now();

    try {
      console.log('🧹 Running scheduled data lifecycle cleanup...\n');

      // Run cleanup
      const result = await this.lifecycleManager.runCleanup();

      this.lastRun = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        success: true,
        result
      };

      // Update last_run_at in database
      await this.updateLastRun(new Date().toISOString());

      logger.info('Scheduled cleanup completed', this.lastRun);

      console.log('\n✅ Scheduled cleanup completed successfully');
      console.log(`   Duration: ${(this.lastRun.duration / 1000).toFixed(2)}s`);
      console.log(`   Next run: ${this.getNextRunTime()?.toLocaleString()}\n`);

    } catch (error) {
      this.lastRun = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      };

      logger.error('Scheduled cleanup failed', {
        error: error.message,
        stack: error.stack,
        lastRun: this.lastRun
      });

      console.error('\n❌ Scheduled cleanup failed:', error.message);
      console.error(`   Duration: ${(this.lastRun.duration / 1000).toFixed(2)}s\n`);
    } finally {
      this.updateNextRun();
    }
  }

  /**
   * Update last run timestamp in database
   * @param {string} timestamp - ISO timestamp
   */
  async updateLastRun(timestamp) {
    try {
      const nextRun = this.getNextRunTime();

      const { error } = await supabase
        .from('cleanup_settings')
        .update({
          last_run_at: timestamp,
          next_run_at: nextRun?.toISOString()
        })
        .eq('id', (await supabase.from('cleanup_settings').select('id').single()).data?.id);

      if (error) {
        logger.warn('Failed to update last_run_at in database', {
          error: error.message
        });
      }
    } catch (error) {
      logger.warn('Failed to update last_run_at', {
        error: error.message
      });
    }
  }

  /**
   * Get next scheduled run time
   *
   * @returns {Date|null} Next run timestamp
   */
  getNextRunTime() {
    if (!this.cronJob) {
      return null;
    }

    // Calculate next run based on cron expression
    try {
      const now = new Date();
      const parser = require('cron-parser');
      const interval = parser.parseExpression(this.cronExpression, {
        currentDate: now,
        tz: this.timezone
      });
      return interval.next().toDate();
    } catch (error) {
      return null;
    }
  }

  /**
   * Update next run timestamp
   */
  updateNextRun() {
    this.nextRun = this.getNextRunTime();
  }

  /**
   * Get scheduler status
   *
   * @returns {Object} Scheduler status
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      cronExpression: this.cronExpression,
      timezone: this.timezone,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      config: {
        unsavedCrawlTTL: this.lifecycleManager.UNSAVED_CRAWL_TTL_DAYS,
        screenshotTTL: this.lifecycleManager.SCREENSHOT_TTL_DAYS,
        batchSize: this.lifecycleManager.CLEANUP_BATCH_SIZE
      }
    };
  }
}

// Singleton instance
let schedulerInstance = null;

export function getCleanupScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new CleanupScheduler();
  }
  return schedulerInstance;
}

export default CleanupScheduler;
