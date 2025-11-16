/**
 * Temporary Cache Manager
 *
 * Manages in-memory cache and temporary file storage during crawl execution.
 * All data is flushed to Supabase in batch after crawl completion.
 *
 * Lifecycle:
 * 1. Crawl Running → Store in memory + temp files (backup)
 * 2. Crawl Complete → Batch upload to Supabase → Clear cache
 * 3. Crawl Failed → Clear cache (no upload)
 */

import fs from 'fs/promises';
import path from 'path';

class TempCacheManager {
  constructor() {
    // In-memory cache (primary storage during crawl)
    this.resultsCache = [];
    this.screenshotsCache = new Map(); // propertyId → screenshot buffer

    // Temp directory for backup (secondary storage)
    this.tempDir = '.temp/crawl-cache';
    this.initialized = false;
  }

  /**
   * Initialize temp cache directory
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp cache directory initialized: ${this.tempDir}`);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize temp cache:', error);
      throw error;
    }
  }

  /**
   * Add crawl result to cache
   *
   * @param {Object} result - Validation result
   * @param {string} propertyId - Property ID
   */
  async addResult(result, propertyId) {
    // Add to memory cache
    this.resultsCache.push({
      propertyId,
      result,
      timestamp: new Date().toISOString()
    });

    // Backup to temp file (optional - for crash recovery)
    if (this.initialized) {
      try {
        const filename = `result_${propertyId}_${Date.now()}.json`;
        const filepath = path.join(this.tempDir, filename);
        await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');
      } catch (error) {
        console.warn(`⚠️ Failed to backup result to temp file:`, error.message);
        // Non-critical error - continue with memory cache only
      }
    }

    console.log(`  💾 Cached result for property ${propertyId} (${this.resultsCache.length} total)`);
  }

  /**
   * Add screenshot buffer to cache
   *
   * @param {string} propertyId - Property ID
   * @param {Buffer} screenshotBuffer - Screenshot buffer
   * @param {Object} metadata - Screenshot metadata
   */
  async addScreenshot(propertyId, screenshotBuffer, metadata = {}) {
    this.screenshotsCache.set(propertyId, {
      buffer: screenshotBuffer,
      metadata: {
        ...metadata,
        capturedAt: new Date().toISOString(),
        size: screenshotBuffer.length
      }
    });

    console.log(`  📸 Cached screenshot for property ${propertyId} (${(screenshotBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
  }

  /**
   * Get all cached results
   *
   * @returns {Array} Cached results
   */
  getResults() {
    return this.resultsCache;
  }

  /**
   * Get all cached screenshots
   *
   * @returns {Map} Cached screenshots
   */
  getScreenshots() {
    return this.screenshotsCache;
  }

  /**
   * Get all cached data (results + screenshots)
   *
   * @returns {Object} All cached data
   */
  getAllData() {
    const screenshots = Array.from(this.screenshotsCache.entries()).map(([propertyId, data]) => ({
      propertyId,
      ...data
    }));

    return {
      results: this.resultsCache,
      screenshots
    };
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats
   */
  getStats() {
    const totalScreenshotSize = Array.from(this.screenshotsCache.values())
      .reduce((sum, item) => sum + item.buffer.length, 0);

    return {
      resultCount: this.resultsCache.length,
      screenshotCount: this.screenshotsCache.size,
      totalScreenshotSizeMB: totalScreenshotSize / 1024 / 1024,
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Clear all cache (memory + temp files)
   * Called after successful batch upload or crawl failure
   */
  async clear() {
    console.log('\n🧹 Clearing temp cache...');

    // Clear memory cache
    const stats = this.getStats();
    this.resultsCache = [];
    this.screenshotsCache.clear();

    console.log(`  ✅ Memory cache cleared: ${stats.resultCount} results, ${stats.screenshotCount} screenshots`);

    // Delete temp files
    if (this.initialized) {
      try {
        const files = await fs.readdir(this.tempDir);
        let deletedCount = 0;

        for (const file of files) {
          try {
            await fs.unlink(path.join(this.tempDir, file));
            deletedCount++;
          } catch (error) {
            console.warn(`  ⚠️ Failed to delete temp file ${file}:`, error.message);
          }
        }

        console.log(`  ✅ Temp files deleted: ${deletedCount} files`);

        // Remove temp directory
        await fs.rmdir(this.tempDir);
        this.initialized = false;

      } catch (error) {
        console.warn(`  ⚠️ Failed to clear temp directory:`, error.message);
      }
    }

    console.log('✅ Temp cache cleared successfully\n');
  }

  /**
   * Export cache data for batch upload
   *
   * @returns {Object} Exported data
   */
  exportForUpload() {
    return {
      results: this.resultsCache,
      screenshots: Array.from(this.screenshotsCache.entries()).map(([propertyId, data]) => ({
        propertyId,
        buffer: data.buffer,
        metadata: data.metadata
      })),
      stats: this.getStats()
    };
  }
}

// Singleton instance
let tempCacheInstance = null;

export function getTempCache() {
  if (!tempCacheInstance) {
    tempCacheInstance = new TempCacheManager();
  }
  return tempCacheInstance;
}

export default TempCacheManager;
