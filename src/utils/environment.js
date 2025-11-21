/**
 * Environment Detection Utility
 *
 * Provides centralized environment detection logic for feature separation
 * between local development (full-featured) and production deployment (queue-based).
 *
 * Architecture:
 * - Render: Queue-based crawl requests (no browser execution)
 * - Local: Immediate or queue-based crawl execution (with browser automation)
 */

/**
 * Check if crawl EXECUTION is disabled (browser automation)
 *
 * Crawl execution is disabled when:
 * - Running on Render (RENDER=true) - memory constraint environment, no browsers
 * - DISABLE_CRAWL_START=true explicitly set
 *
 * When disabled, crawl requests are added to queue instead of executing immediately.
 *
 * @returns {boolean} true if crawl execution should be disabled, false otherwise
 */
export function isCrawlDisabled() {
  // Render environment OR explicitly disabled
  return process.env.RENDER === 'true' ||
         process.env.DISABLE_CRAWL_START === 'true';
}

/**
 * Check if crawl REQUEST creation is enabled (queue writing)
 *
 * Crawl requests can be created in both environments:
 * - Render: Adds to queue (for local worker to process)
 * - Local: Can execute immediately or add to queue
 *
 * @returns {boolean} true if crawl requests can be created
 */
export function isCrawlRequestEnabled() {
  // Always allow request creation (both Render and Local)
  return true;
}

/**
 * Get crawl execution mode based on environment
 *
 * @returns {'queue'|'immediate'} Execution mode
 * - 'queue': Add to queue for later processing (Render environment)
 * - 'immediate': Execute immediately (Local environment, backward compatible)
 */
export function getCrawlExecutionMode() {
  if (isCrawlDisabled()) {
    return 'queue'; // Render: Add to queue, don't execute
  }
  return 'immediate'; // Local: Execute immediately (existing behavior)
}

/**
 * Get comprehensive environment information
 *
 * @returns {Object} Environment details
 * @returns {boolean} Object.isRender - true if running on Render.com
 * @returns {boolean} Object.crawlDisabled - true if crawl execution is disabled
 * @returns {string} Object.crawlExecutionMode - 'queue' or 'immediate'
 * @returns {string} Object.environment - Node environment (development/production)
 */
export function getEnvironmentInfo() {
  return {
    isRender: process.env.RENDER === 'true',
    crawlDisabled: isCrawlDisabled(),
    crawlExecutionMode: getCrawlExecutionMode(),
    environment: process.env.NODE_ENV || 'development'
  };
}
