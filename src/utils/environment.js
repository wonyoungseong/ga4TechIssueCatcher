/**
 * Environment Detection Utility
 *
 * Provides centralized environment detection logic for feature separation
 * between local development (full-featured) and production deployment (read-only).
 */

/**
 * Check if crawl execution should be disabled in this environment
 *
 * @returns {boolean} true if crawl should be disabled, false otherwise
 */
export function isCrawlDisabled() {
  // Render environment OR explicitly disabled
  return process.env.RENDER === 'true' ||
         process.env.DISABLE_CRAWL_START === 'true';
}

/**
 * Get comprehensive environment information
 *
 * @returns {Object} Environment details
 * @returns {boolean} Object.isRender - true if running on Render.com
 * @returns {boolean} Object.crawlDisabled - true if crawl execution is disabled
 * @returns {string} Object.environment - Node environment (development/production)
 */
export function getEnvironmentInfo() {
  return {
    isRender: process.env.RENDER === 'true',
    crawlDisabled: isCrawlDisabled(),
    environment: process.env.NODE_ENV || 'development'
  };
}
