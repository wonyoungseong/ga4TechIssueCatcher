/**
 * Batch Upload Manager
 *
 * Handles batch upload of crawl results and screenshots to Supabase.
 * Uploads are performed after crawl completion to minimize network overhead.
 *
 * Upload Strategy:
 * 1. Results: Batch INSERT (50 records per chunk)
 * 2. Screenshots: Parallel upload to Supabase Storage (5 concurrent)
 * 3. Error Handling: Retry failed uploads with exponential backoff
 */

import { supabase, Tables } from '../utils/supabase.js';
import logger from '../utils/logger.js';

class BatchUploadManager {
  constructor() {
    this.BATCH_SIZE = 50; // Results per batch
    this.CONCURRENT_UPLOADS = 5; // Parallel screenshot uploads
    this.RETRY_ATTEMPTS = 3;
    this.RETRY_DELAY_MS = 1000;
  }

  /**
   * Upload all cached data to Supabase in batch
   *
   * @param {string} runId - Crawl run ID
   * @param {Object} cacheData - Exported cache data from TempCacheManager
   * @returns {Promise<Object>} Upload summary
   */
  async uploadAll(runId, cacheData) {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('📤 Starting Batch Upload to Supabase');
    console.log('='.repeat(60));
    console.log(`Run ID: ${runId}`);
    console.log(`Results: ${cacheData.results.length}`);
    console.log(`Screenshots: ${cacheData.screenshots.length}`);
    if (cacheData.stats) {
      console.log(`Memory Usage: ${cacheData.stats.memoryUsageMB.toFixed(2)}MB`);
    }
    console.log('='.repeat(60) + '\n');

    const summary = {
      runId,
      startTime: new Date().toISOString(),
      results: { total: 0, success: 0, failed: 0 },
      screenshots: { total: 0, success: 0, failed: 0 },
      errors: [],
      duration: 0
    };

    try {
      // Step 1: Upload results in batches
      console.log('📊 Step 1: Uploading results in batches...\n');
      const resultsUploadSummary = await this.uploadResults(runId, cacheData.results);
      summary.results = resultsUploadSummary;

      // Step 2: Upload screenshots in parallel
      console.log('\n📸 Step 2: Uploading screenshots in parallel...\n');
      const screenshotsUploadSummary = await this.uploadScreenshots(runId, cacheData.screenshots);
      summary.screenshots = screenshotsUploadSummary;

      // Step 3: Update crawl run statistics
      console.log('\n📈 Step 3: Updating crawl run statistics...\n');
      await this.updateCrawlRunStats(runId, summary);

      summary.duration = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log('✅ Batch Upload Completed');
      console.log('='.repeat(60));
      console.log(`Results: ${summary.results.success}/${summary.results.total} uploaded`);
      console.log(`Screenshots: ${summary.screenshots.success}/${summary.screenshots.total} uploaded`);
      console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
      console.log('='.repeat(60) + '\n');

      return summary;

    } catch (error) {
      console.error('\n❌ Batch upload failed:', error);
      summary.errors.push({
        type: 'BATCH_UPLOAD_ERROR',
        message: error.message,
        stack: error.stack
      });
      summary.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Upload results in batches
   *
   * @param {string} runId - Crawl run ID
   * @param {Array} results - Cached results
   * @returns {Promise<Object>} Upload summary
   */
  async uploadResults(runId, results) {
    const summary = {
      total: results.length,
      success: 0,
      failed: 0,
      errors: []
    };

    if (results.length === 0) {
      console.log('  ℹ️ No results to upload');
      return summary;
    }

    // Transform results to Supabase format
    // Filter out results without valid UUID propertyId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const transformedResults = results
      .filter(item => {
        if (!item.propertyId) {
          console.warn(`  ⚠️ Skipping result without propertyId:`, item);
          return false;
        }
        // Validate UUID format
        if (!uuidRegex.test(item.propertyId)) {
          console.warn(`  ⚠️ Skipping result with invalid UUID propertyId: ${item.propertyId} (slug fallback)`);
          return false;
        }
        return true;
      })
      .map(item => ({
        crawl_run_id: runId,
        property_id: item.propertyId,
        validation_status: item.result.isValid ? 'passed' : 'failed',
        collected_ga4_id: item.result.measurementId?.actual || null,
        collected_gtm_id: item.result.gtmId?.allFound || [],
        page_view_event_detected: (item.result.pageViewEvent?.count > 0) || false,
        has_issues: !item.result.isValid,
        issue_types: item.result.issues?.map(issue => issue.type) || [],
        issue_summary: item.result.issues?.map(i => i.message).join('; ') || null,
        screenshot_path: item.result.screenshotPath || null,
        screenshot_url: null, // Will be updated after screenshot upload
        validation_duration_ms: item.result.executionTimeMs,
        phase: item.result.phase || 1,
        validation_details: {
          measurementId: item.result.measurementId || null,
          gtmId: item.result.gtmId || null,
          pageViewEvent: item.result.pageViewEvent || null
        }
      }));

    // Upload in chunks
    const chunks = this.chunkArray(transformedResults, this.BATCH_SIZE);
    console.log(`  📦 Uploading ${transformedResults.length} results in ${chunks.length} batches...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`\n  📤 Batch ${i + 1}/${chunks.length}: ${chunk.length} records`);

      try {
        const { data, error } = await this.retryOperation(async () => {
          return await supabase
            .from(Tables.CRAWL_RESULTS)
            .insert(chunk)
            .select();
        });

        if (error) {
          throw error;
        }

        summary.success += chunk.length;
        console.log(`     ✅ Uploaded ${chunk.length} records`);

      } catch (error) {
        console.error(`     ❌ Batch ${i + 1} failed:`, error.message);
        summary.failed += chunk.length;
        summary.errors.push({
          batch: i + 1,
          size: chunk.length,
          error: error.message
        });

        logger.error('Batch upload failed', {
          runId,
          batch: i + 1,
          size: chunk.length,
          error: error.message
        });
      }
    }

    console.log(`\n  ✅ Results upload completed: ${summary.success}/${summary.total} successful`);
    return summary;
  }

  /**
   * Upload screenshots in parallel
   *
   * @param {string} runId - Crawl run ID
   * @param {Array} screenshots - Cached screenshots
   * @returns {Promise<Object>} Upload summary
   */
  async uploadScreenshots(runId, screenshots) {
    const summary = {
      total: screenshots.length,
      success: 0,
      failed: 0,
      errors: []
    };

    if (screenshots.length === 0) {
      console.log('  ℹ️ No screenshots to upload');
      return summary;
    }

    console.log(`  📸 Uploading ${screenshots.length} screenshots (${this.CONCURRENT_UPLOADS} concurrent)...`);

    // Filter screenshots with valid UUID propertyIds
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validScreenshots = screenshots.filter(screenshot => {
      if (!screenshot.propertyId) {
        console.warn(`  ⚠️ Skipping screenshot without propertyId`);
        return false;
      }
      if (!uuidRegex.test(screenshot.propertyId)) {
        console.warn(`  ⚠️ Skipping screenshot with invalid UUID propertyId: ${screenshot.propertyId}`);
        return false;
      }
      return true;
    });

    if (validScreenshots.length === 0) {
      console.log('  ⚠️ No valid screenshots to upload (all have invalid propertyIds)');
      return summary;
    }

    // Process screenshots in parallel batches
    const chunks = this.chunkArray(validScreenshots, this.CONCURRENT_UPLOADS);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`\n  📤 Batch ${i + 1}/${chunks.length}: ${chunk.length} screenshots`);

      const uploadPromises = chunk.map(async (screenshot) => {
        try {
          const filename = `${runId}/${screenshot.propertyId}_${Date.now()}.jpg`;

          // Upload to Supabase Storage
          const { data, error } = await this.retryOperation(async () => {
            return await supabase.storage
              .from('screenshots')
              .upload(filename, screenshot.buffer, {
                contentType: 'image/jpeg',
                upsert: false
              });
          });

          if (error) {
            throw error;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('screenshots')
            .getPublicUrl(filename);

          // Update crawl_results with screenshot URL
          const { error: updateError } = await supabase
            .from(Tables.CRAWL_RESULTS)
            .update({ screenshot_url: publicUrl })
            .eq('property_id', screenshot.propertyId)
            .eq('crawl_run_id', runId);

          if (updateError) {
            console.error(`     ⚠️ Failed to update screenshot_url for ${screenshot.propertyId}:`, updateError.message);
          }

          summary.success++;
          console.log(`     ✅ ${screenshot.propertyId} → ${publicUrl}`);

          return {
            propertyId: screenshot.propertyId,
            url: publicUrl,
            success: true
          };

        } catch (error) {
          summary.failed++;
          summary.errors.push({
            propertyId: screenshot.propertyId,
            error: error.message
          });

          console.error(`     ❌ ${screenshot.propertyId} failed:`, error.message);

          return {
            propertyId: screenshot.propertyId,
            success: false,
            error: error.message
          };
        }
      });

      await Promise.all(uploadPromises);
    }

    console.log(`\n  ✅ Screenshots upload completed: ${summary.success}/${summary.total} successful`);
    return summary;
  }

  /**
   * Update crawl run statistics after batch upload
   *
   * @param {string} runId - Crawl run ID
   * @param {Object} summary - Upload summary
   */
  async updateCrawlRunStats(runId, summary) {
    try {
      const { error } = await supabase
        .from(Tables.CRAWL_RUNS)
        .update({
          upload_completed_at: new Date().toISOString(),
          upload_duration_ms: summary.duration,
          upload_success_count: summary.results.success,
          upload_failed_count: summary.results.failed
        })
        .eq('id', runId);

      if (error) {
        throw error;
      }

      console.log('  ✅ Crawl run statistics updated');

    } catch (error) {
      console.error('  ❌ Failed to update crawl run stats:', error);
      logger.error('Failed to update crawl run stats', {
        runId,
        error: error.message
      });
    }
  }

  /**
   * Retry operation with exponential backoff
   *
   * @param {Function} operation - Async operation to retry
   * @param {number} maxAttempts - Maximum retry attempts
   * @returns {Promise<any>} Operation result
   */
  async retryOperation(operation, maxAttempts = this.RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`     🔄 Retry ${attempt}/${maxAttempts} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
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

export default BatchUploadManager;
