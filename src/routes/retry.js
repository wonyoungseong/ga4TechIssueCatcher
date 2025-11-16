/**
 * Retry Queue API Routes
 *
 * API endpoints for manual retry queue processing and statistics
 *
 * Story 10.3: Network Error Retry Queue System
 */

import express from 'express';
import { BrowserPool } from '../modules/browserPoolManager.js';
import { processRetryQueue } from '../modules/retryQueue.js';
import supabase from '../utils/supabase.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/retry-queue/process
 * Manually trigger retry queue processing
 */
router.post('/process', async (req, res) => {
  console.log('\n📋 Manual retry queue processing requested');
  logger.info('Manual retry queue processing requested');

  let browserPool = null;

  try {
    // Initialize browser pool
    console.log('🌐 Initializing browser pool...');
    browserPool = new BrowserPool();
    await browserPool.initialize();

    // Generate date string for results (YYYYMMDD)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

    // Process retry queue
    const stats = await processRetryQueue(browserPool.browsers[0], dateStr);

    // Clean up browser pool
    await browserPool.close();

    console.log('✅ Manual retry queue processing completed');
    logger.info('Manual retry queue processing completed', stats);

    res.json({
      success: true,
      message: 'Retry queue processed successfully',
      stats
    });
  } catch (error) {
    console.error('❌ Manual retry queue processing failed:', error.message);
    logger.error('Manual retry queue processing failed', {
      error: error.message,
      stack: error.stack
    });

    // Clean up browser pool on error
    if (browserPool) {
      try {
        await browserPool.close();
      } catch (cleanupError) {
        console.error('⚠️ Browser pool cleanup failed:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/retry-queue/stats
 * Get retry queue statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get counts by status using direct aggregation
    const { data: allRetries, error: countError } = await supabase
      .from('retry_queue')
      .select('status');

    if (countError) {
      throw countError;
    }

    const stats = {
      pending: allRetries.filter(r => r.status === 'pending').length,
      retrying: allRetries.filter(r => r.status === 'retrying').length,
      resolved: allRetries.filter(r => r.status === 'resolved').length,
      permanent_failure: allRetries.filter(r => r.status === 'permanent_failure').length,
      total: allRetries.length
    };

    // Get next retry time
    const { data: nextRetry, error: nextError } = await supabase
      .from('retry_queue')
      .select('next_retry_at')
      .eq('status', 'pending')
      .order('next_retry_at', { ascending: true })
      .limit(1)
      .single();

    if (!nextError && nextRetry) {
      stats.next_retry_at = nextRetry.next_retry_at;
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Failed to fetch retry queue stats:', error.message);
    logger.error('Retry queue stats fetch failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/retry-queue/list
 * List retry queue items with filtering
 */
router.get('/list', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('retry_queue')
      .select('*, properties(property_name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      items: data,
      count: data.length
    });
  } catch (error) {
    console.error('❌ Failed to list retry queue:', error.message);
    logger.error('Retry queue list failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
