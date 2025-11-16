/**
 * Data Lifecycle Cleanup API Routes
 *
 * Provides endpoints for TTL-based data cleanup:
 * - Manual cleanup trigger
 * - Scheduled cleanup (cron)
 * - Cleanup status and logs
 */

import express from 'express';
import DataLifecycleManager from '../modules/dataLifecycleManager.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Cleanup manager instance
const lifecycleManager = new DataLifecycleManager();

// Track last cleanup execution
let lastCleanupResult = null;
let isCleanupRunning = false;

/**
 * POST /api/cleanup/run
 * Manually trigger data lifecycle cleanup
 */
router.post('/run', async (req, res) => {
  try {
    // Prevent concurrent cleanup
    if (isCleanupRunning) {
      return res.status(409).json({
        success: false,
        error: 'Cleanup is already running',
        lastResult: lastCleanupResult
      });
    }

    isCleanupRunning = true;

    console.log('🧹 Manual cleanup triggered via API');

    // Run cleanup
    const result = await lifecycleManager.runCleanup();
    lastCleanupResult = result;
    isCleanupRunning = false;

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: result
    });

  } catch (error) {
    isCleanupRunning = false;
    console.error('Cleanup error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cleanup/status
 * Get current cleanup status and last execution result
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        isRunning: isCleanupRunning,
        lastCleanup: lastCleanupResult,
        config: {
          unsavedCrawlTTL: lifecycleManager.UNSAVED_CRAWL_TTL_DAYS,
          screenshotTTL: lifecycleManager.SCREENSHOT_TTL_DAYS,
          batchSize: lifecycleManager.CLEANUP_BATCH_SIZE
        }
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
 * GET /api/cleanup/schedule
 * Get current cleanup schedule settings
 */
router.get('/schedule', async (req, res) => {
  try {
    const { supabase } = await import('../utils/supabase.js');

    const { data, error } = await supabase
      .from('cleanup_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default settings if none exist
    const settings = data || {
      cron_expression: '0 3 * * *',
      timezone: 'Asia/Seoul',
      is_enabled: true,
      unsaved_crawl_ttl_days: 30,
      screenshot_ttl_days: 30,
      batch_size: 100
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cleanup/schedule
 * Configure automatic cleanup schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    const {
      cronExpression,
      timezone,
      enabled,
      unsavedCrawlTTLDays,
      screenshotTTLDays,
      batchSize
    } = req.body;

    const { supabase } = await import('../utils/supabase.js');
    const { getCleanupScheduler } = await import('../utils/cleanupScheduler.js');

    // Validate cron expression if provided
    if (cronExpression) {
      const cron = await import('node-cron');
      if (!cron.default.validate(cronExpression)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid cron expression',
          code: 'INVALID_CRON_EXPRESSION'
        });
      }
    }

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from('cleanup_settings')
      .select('id')
      .single();

    const updateData = {};
    if (cronExpression !== undefined) updateData.cron_expression = cronExpression;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (enabled !== undefined) updateData.is_enabled = enabled;
    if (unsavedCrawlTTLDays !== undefined) updateData.unsaved_crawl_ttl_days = unsavedCrawlTTLDays;
    if (screenshotTTLDays !== undefined) updateData.screenshot_ttl_days = screenshotTTLDays;
    if (batchSize !== undefined) updateData.batch_size = batchSize;

    let result;
    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('cleanup_settings')
        .update(updateData)
        .eq('id', existingSettings.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new settings
      const { data, error } = await supabase
        .from('cleanup_settings')
        .insert({
          cron_expression: cronExpression || '0 3 * * *',
          timezone: timezone || 'Asia/Seoul',
          is_enabled: enabled !== undefined ? enabled : true,
          unsaved_crawl_ttl_days: unsavedCrawlTTLDays || 30,
          screenshot_ttl_days: screenshotTTLDays || 30,
          batch_size: batchSize || 100
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Restart scheduler with new settings if enabled
    const scheduler = getCleanupScheduler();
    if (result.is_enabled) {
      scheduler.stop();
      scheduler.settingsLoaded = false; // Force reload from database
      await scheduler.start();
    } else {
      scheduler.stop();
    }

    res.json({
      success: true,
      message: 'Cleanup schedule updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating cleanup schedule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cleanup/move-to-permanent
 * Move screenshots to permanent storage when saving crawl run
 */
router.post('/move-to-permanent', async (req, res) => {
  try {
    const { runId, screenshotPaths } = req.body;

    if (!runId || !Array.isArray(screenshotPaths)) {
      return res.status(400).json({
        success: false,
        error: 'runId and screenshotPaths array are required'
      });
    }

    console.log(`📸 Moving ${screenshotPaths.length} screenshots to permanent storage for run ${runId}`);

    const results = await Promise.all(
      screenshotPaths.map(async (path) => {
        try {
          const permanentUrl = await lifecycleManager.moveScreenshotToPermanent(path, runId);
          return {
            originalPath: path,
            permanentUrl,
            success: true
          };
        } catch (error) {
          return {
            originalPath: path,
            success: false,
            error: error.message
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `${successCount}/${screenshotPaths.length} screenshots moved to permanent storage`,
      data: results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
