/**
 * Data Lifecycle Manager
 *
 * Manages TTL-based data cleanup for crawl results and screenshots.
 *
 * Cleanup Rules:
 * 1. Unsaved crawl runs: Delete after 30 days
 * 2. Unsaved screenshots: Delete after 30 days
 * 3. Saved crawl runs: Keep forever (manual delete only)
 * 4. Saved screenshots: Keep forever (moved to permanent bucket)
 *
 * Scheduled Tasks:
 * - Daily cleanup at 03:00 AM (configurable via cron)
 * - Manual cleanup via API endpoint
 */

import { supabase, Tables, CrawlRunStatus } from '../utils/supabase.js';
import logger from '../utils/logger.js';

class DataLifecycleManager {
  constructor() {
    // TTL configurations (in days)
    this.UNSAVED_CRAWL_TTL_DAYS = parseInt(process.env.UNSAVED_CRAWL_TTL_DAYS) || 30;
    this.SCREENSHOT_TTL_DAYS = parseInt(process.env.SCREENSHOT_TTL_DAYS) || 30;

    // Cleanup batch size
    this.CLEANUP_BATCH_SIZE = 100;
  }

  /**
   * Run full cleanup cycle
   * Cleans up expired crawl runs, results, and screenshots
   *
   * @returns {Promise<Object>} Cleanup summary
   */
  async runCleanup() {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('🧹 Starting Data Lifecycle Cleanup');
    console.log('='.repeat(60));
    console.log(`Unsaved Crawl TTL: ${this.UNSAVED_CRAWL_TTL_DAYS} days`);
    console.log(`Screenshot TTL: ${this.SCREENSHOT_TTL_DAYS} days`);
    console.log('='.repeat(60) + '\n');

    const summary = {
      startTime: new Date().toISOString(),
      crawlRuns: { deleted: 0, errors: 0 },
      crawlResults: { deleted: 0, errors: 0 },
      screenshots: { deleted: 0, errors: 0 },
      duration: 0
    };

    try {
      // Step 1: Clean up expired unsaved crawl runs
      console.log('📊 Step 1: Cleaning up expired crawl runs...\n');
      const crawlRunsCleanup = await this.cleanupExpiredCrawlRuns();
      summary.crawlRuns = crawlRunsCleanup;

      // Step 2: Clean up orphaned crawl results
      console.log('\n📋 Step 2: Cleaning up orphaned crawl results...\n');
      const crawlResultsCleanup = await this.cleanupOrphanedResults();
      summary.crawlResults = crawlResultsCleanup;

      // Step 3: Clean up expired screenshots
      console.log('\n📸 Step 3: Cleaning up expired screenshots...\n');
      const screenshotsCleanup = await this.cleanupExpiredScreenshots();
      summary.screenshots = screenshotsCleanup;

      summary.duration = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log('✅ Data Lifecycle Cleanup Completed');
      console.log('='.repeat(60));
      console.log(`Crawl Runs Deleted: ${summary.crawlRuns.deleted}`);
      console.log(`Crawl Results Deleted: ${summary.crawlResults.deleted}`);
      console.log(`Screenshots Deleted: ${summary.screenshots.deleted}`);
      console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
      console.log('='.repeat(60) + '\n');

      logger.info('Data lifecycle cleanup completed', summary);

      return summary;

    } catch (error) {
      console.error('\n❌ Cleanup failed:', error);
      summary.duration = Date.now() - startTime;
      logger.error('Data lifecycle cleanup failed', {
        error: error.message,
        stack: error.stack,
        summary
      });
      throw error;
    }
  }

  /**
   * Clean up expired unsaved crawl runs
   * Deletes crawl runs that are:
   * - Not saved (is_saved = false)
   * - Older than UNSAVED_CRAWL_TTL_DAYS
   * - Status: completed, failed, or cancelled
   *
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanupExpiredCrawlRuns() {
    const summary = { deleted: 0, errors: 0 };

    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.UNSAVED_CRAWL_TTL_DAYS);
      const cutoffISO = cutoffDate.toISOString();

      console.log(`  📅 Cutoff date: ${cutoffDate.toLocaleDateString()} (${this.UNSAVED_CRAWL_TTL_DAYS} days ago)`);

      // Find expired crawl runs
      const { data: expiredRuns, error: selectError } = await supabase
        .from(Tables.CRAWL_RUNS)
        .select('id, run_date, started_at, status')
        .eq('is_saved', false)
        .in('status', [CrawlRunStatus.COMPLETED, CrawlRunStatus.FAILED, CrawlRunStatus.CANCELLED])
        .lt('started_at', cutoffISO)
        .order('started_at', { ascending: true });

      if (selectError) {
        throw selectError;
      }

      if (!expiredRuns || expiredRuns.length === 0) {
        console.log('  ℹ️ No expired crawl runs found');
        return summary;
      }

      console.log(`  🗑️ Found ${expiredRuns.length} expired crawl runs to delete`);

      // Delete in batches (to avoid timeout)
      const batches = this.chunkArray(expiredRuns, this.CLEANUP_BATCH_SIZE);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const runIds = batch.map(run => run.id);

        console.log(`\n  📦 Batch ${i + 1}/${batches.length}: Deleting ${batch.length} runs...`);

        try {
          // Delete cascade will automatically delete related crawl_results
          const { error: deleteError } = await supabase
            .from(Tables.CRAWL_RUNS)
            .delete()
            .in('id', runIds);

          if (deleteError) {
            throw deleteError;
          }

          summary.deleted += batch.length;
          console.log(`     ✅ Deleted ${batch.length} runs`);

        } catch (error) {
          console.error(`     ❌ Batch ${i + 1} failed:`, error.message);
          summary.errors += batch.length;
          logger.error('Failed to delete expired crawl runs batch', {
            batch: i + 1,
            runIds,
            error: error.message
          });
        }
      }

      console.log(`\n  ✅ Cleanup completed: ${summary.deleted} crawl runs deleted`);
      return summary;

    } catch (error) {
      console.error('  ❌ Failed to clean up crawl runs:', error);
      logger.error('Failed to clean up expired crawl runs', {
        error: error.message,
        stack: error.stack
      });
      return summary;
    }
  }

  /**
   * Clean up orphaned crawl results
   * Deletes crawl results where parent crawl_run no longer exists
   *
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanupOrphanedResults() {
    const summary = { deleted: 0, errors: 0 };

    try {
      console.log('  🔍 Finding orphaned crawl results...');

      // Find orphaned results (results with no parent crawl_run)
      // This uses a LEFT JOIN to find results where crawl_run_id doesn't exist in crawl_runs
      const { data: orphanedResults, error: selectError } = await supabase
        .rpc('find_orphaned_crawl_results');

      if (selectError) {
        // If RPC doesn't exist, skip this step
        if (selectError.code === '42883') {
          console.log('  ℹ️ Orphaned results cleanup RPC not available (manual cleanup required)');
          return summary;
        }
        throw selectError;
      }

      if (!orphanedResults || orphanedResults.length === 0) {
        console.log('  ℹ️ No orphaned crawl results found');
        return summary;
      }

      console.log(`  🗑️ Found ${orphanedResults.length} orphaned results to delete`);

      // Delete in batches
      const batches = this.chunkArray(orphanedResults, this.CLEANUP_BATCH_SIZE);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const resultIds = batch.map(result => result.id);

        console.log(`\n  📦 Batch ${i + 1}/${batches.length}: Deleting ${batch.length} results...`);

        try {
          const { error: deleteError } = await supabase
            .from(Tables.CRAWL_RESULTS)
            .delete()
            .in('id', resultIds);

          if (deleteError) {
            throw deleteError;
          }

          summary.deleted += batch.length;
          console.log(`     ✅ Deleted ${batch.length} results`);

        } catch (error) {
          console.error(`     ❌ Batch ${i + 1} failed:`, error.message);
          summary.errors += batch.length;
        }
      }

      console.log(`\n  ✅ Cleanup completed: ${summary.deleted} orphaned results deleted`);
      return summary;

    } catch (error) {
      console.error('  ❌ Failed to clean up orphaned results:', error);
      return summary;
    }
  }

  /**
   * Clean up expired screenshots from Supabase Storage
   * Deletes screenshots that are:
   * - Older than SCREENSHOT_TTL_DAYS
   * - Not associated with saved crawl runs
   *
   * @returns {Promise<Object>} Cleanup summary
   */
  async cleanupExpiredScreenshots() {
    const summary = { deleted: 0, errors: 0 };

    try {
      console.log('  🔍 Finding expired screenshots...');

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.SCREENSHOT_TTL_DAYS);
      const cutoffTimestamp = cutoffDate.getTime();

      console.log(`  📅 Cutoff date: ${cutoffDate.toLocaleDateString()} (${this.SCREENSHOT_TTL_DAYS} days ago)`);

      // List all files in screenshots bucket
      const { data: files, error: listError } = await supabase.storage
        .from('screenshots')
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'asc' }
        });

      if (listError) {
        throw listError;
      }

      if (!files || files.length === 0) {
        console.log('  ℹ️ No screenshots found in storage');
        return summary;
      }

      console.log(`  📊 Found ${files.length} screenshots in storage`);

      // Filter expired screenshots
      const expiredFiles = files.filter(file => {
        const fileDate = new Date(file.created_at);
        return fileDate.getTime() < cutoffTimestamp;
      });

      if (expiredFiles.length === 0) {
        console.log('  ℹ️ No expired screenshots found');
        return summary;
      }

      console.log(`  🗑️ Found ${expiredFiles.length} expired screenshots to delete`);

      // Delete in batches
      const batches = this.chunkArray(expiredFiles, this.CLEANUP_BATCH_SIZE);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const filePaths = batch.map(file => file.name);

        console.log(`\n  📦 Batch ${i + 1}/${batches.length}: Deleting ${batch.length} screenshots...`);

        try {
          const { error: deleteError } = await supabase.storage
            .from('screenshots')
            .remove(filePaths);

          if (deleteError) {
            throw deleteError;
          }

          summary.deleted += batch.length;
          console.log(`     ✅ Deleted ${batch.length} screenshots`);

        } catch (error) {
          console.error(`     ❌ Batch ${i + 1} failed:`, error.message);
          summary.errors += batch.length;
        }
      }

      console.log(`\n  ✅ Cleanup completed: ${summary.deleted} screenshots deleted`);
      return summary;

    } catch (error) {
      console.error('  ❌ Failed to clean up screenshots:', error);
      return summary;
    }
  }

  /**
   * Move screenshot to permanent storage
   * Called when user saves a crawl run
   *
   * @param {string} screenshotPath - Original screenshot path
   * @param {string} runId - Crawl run ID
   * @returns {Promise<string>} New permanent screenshot URL
   */
  async moveScreenshotToPermanent(screenshotPath, runId) {
    try {
      // Extract filename from path
      const filename = screenshotPath.split('/').pop();
      const newPath = `permanent/${runId}/${filename}`;

      // Copy to permanent bucket
      const { data, error } = await supabase.storage
        .from('screenshots')
        .copy(screenshotPath, newPath);

      if (error) {
        throw error;
      }

      // Get public URL for permanent screenshot
      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(newPath);

      console.log(`  📸 Screenshot moved to permanent storage: ${publicUrl}`);

      return publicUrl;

    } catch (error) {
      console.error('  ❌ Failed to move screenshot to permanent storage:', error);
      logger.error('Failed to move screenshot to permanent storage', {
        screenshotPath,
        runId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Split array into chunks
   *
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array<Array>} Chunked array
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export default DataLifecycleManager;
