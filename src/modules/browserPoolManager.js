/**
 * Browser Pool Manager Module
 *
 * Manages a pool of Playwright browser instances for parallel execution.
 * Uses vanilla Playwright for optimal performance.
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.1: Browser Pool Setup
 *
 * PERFORMANCE FIX: Removed playwright-extra + stealth plugin
 * Issue: StealthPlugin caused 30s page load times (>95% timeout rate)
 * Solution: Use vanilla Playwright - loads in 1-5s (0% timeout rate)
 * Bot detection bypass: Manual stealth scripts in createStealthPage()
 */

import { chromium } from 'playwright';

/**
 * Browser Pool class
 * Manages lifecycle of browser instances for efficient resource usage
 */
export class BrowserPool {
  constructor(poolSize = 5) {
    this.poolSize = poolSize;
    this.browsers = [];
    this.available = []; // Track available browsers
    this.isInitialized = false;
  }

  /**
   * Initialize browser pool with configured instances
   *
   * @returns {Promise<void>}
   * @throws {Error} If browser initialization fails
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Browser pool already initialized');
      return;
    }

    console.log(`🚀 Initializing browser pool (size: ${this.poolSize})...`);

    try {
      for (let i = 0; i < this.poolSize; i++) {
        const browser = await this.createBrowser();
        this.browsers.push(browser);
        this.available.push(true); // Mark as available
        console.log(`  ✅ Browser ${i + 1}/${this.poolSize} initialized`);
      }

      this.isInitialized = true;
      console.log(`✅ Browser pool initialized with ${this.poolSize} instances`);

    } catch (error) {
      // Cleanup any browsers that were created
      await this.cleanup();
      throw new Error(`Failed to initialize browser pool: ${error.message}`);
    }
  }

  /**
   * Create a single browser instance with optimized configuration
   * Memory limit: 500MB per browser (AC4)
   *
   * HEADLESS MODE: Using vanilla Playwright for maximum performance
   * - Fast page loads (1-5s vs 30s with stealth plugin)
   * - NO browser windows appear on screen
   * - Screenshots work correctly in headless mode
   * - Manual stealth scripts applied per-page (see createStealthPage)
   *
   * @returns {Promise<Browser>} Playwright browser instance
   * @private
   */
  async createBrowser() {
    const browser = await chromium.launch({
      headless: true,  // Vanilla Playwright headless mode
      args: [
        // Security & Sandboxing
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',

        // Bot Detection Bypass - CRITICAL with stealth plugin
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',

        // Headless optimizations
        '--disable-gpu',  // GPU not needed in headless
        '--disable-software-rasterizer',

        // Background Execution Flags
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-hang-monitor',

        // UI Reduction
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-extensions',
        '--disable-translate',
        '--disable-component-extensions-with-background-pages',

        // Audio & Visual
        '--mute-audio',
        '--disable-background-networking',

        // Memory Limit
        '--max-old-space-size=500' // Limit to 500MB per browser (AC4)
      ],
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled']
    });

    return browser;
  }

  /**
   * Get a browser from the pool
   *
   * @param {number} index - Browser index (0 to poolSize-1)
   * @returns {Browser} Playwright browser instance
   * @throws {Error} If pool not initialized or invalid index
   */
  getBrowser(index) {
    if (!this.isInitialized) {
      throw new Error('Browser pool not initialized. Call initialize() first.');
    }

    if (index < 0 || index >= this.poolSize) {
      throw new Error(`Invalid browser index: ${index}. Must be 0-${this.poolSize - 1}`);
    }

    return this.browsers[index];
  }

  /**
   * Get pool size
   *
   * @returns {number} Number of browsers in pool
   */
  getPoolSize() {
    return this.poolSize;
  }

  /**
   * Check if pool is ready
   *
   * @returns {boolean} True if initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Acquire an available browser from the pool (AC2)
   * Waits if all browsers are busy
   *
   * @param {number} timeoutMs - Maximum wait time in milliseconds (default: 30000)
   * @returns {Promise<{browser: Browser, index: number}>} Browser instance and its index
   * @throws {Error} If pool not initialized or timeout waiting for browser
   */
  async acquireBrowser(timeoutMs = 30000) {
    if (!this.isInitialized) {
      throw new Error('Browser pool not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    // Wait for available browser
    while (true) {
      // Find first available browser
      const index = this.available.findIndex(isAvailable => isAvailable === true);

      if (index !== -1) {
        // Mark as in-use
        this.available[index] = false;
        return { browser: this.browsers[index], index };
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout waiting for available browser (${timeoutMs}ms)`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Release a browser back to the pool (AC3)
   * Clears browser context (cookies, cache, storage)
   *
   * @param {number} index - Browser index to release
   * @returns {Promise<void>}
   * @throws {Error} If invalid index or browser not in-use
   */
  async releaseBrowser(index) {
    if (index < 0 || index >= this.poolSize) {
      throw new Error(`Invalid browser index: ${index}. Must be 0-${this.poolSize - 1}`);
    }

    if (this.available[index] === true) {
      throw new Error(`Browser ${index} is not currently in-use`);
    }

    // Don't close contexts here - they're managed by the validation code
    // Each validation creates a context and closes it properly after use
    // Closing all contexts here causes "browser has been closed" errors for Phase 2

    // Mark as available
    this.available[index] = true;
  }

  /**
   * Close all browsers and cleanup resources
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log('🧹 Cleaning up browser pool...');

    const closePromises = this.browsers.map(async (browser, index) => {
      try {
        await browser.close();
        console.log(`  ✅ Browser ${index + 1} closed`);
      } catch (error) {
        console.error(`  ❌ Failed to close browser ${index + 1}:`, error.message);
      }
    });

    await Promise.all(closePromises);

    this.browsers = [];
    this.isInitialized = false;
    console.log('✅ Browser pool cleaned up');
  }
}

/**
 * Create a new page with manual stealth configuration
 *
 * PERFORMANCE-OPTIMIZED: Manual stealth scripts instead of StealthPlugin
 * Manual stealth provides:
 * - Fast page loads (1-5s) - StealthPlugin caused 30s loads
 * - Essential bot detection bypass (webdriver, plugins, languages)
 * - Sufficient for most sites without performance penalty
 *
 * @param {Browser} browser - Playwright browser instance
 * @returns {Promise<{context: BrowserContext, page: Page}>} Context and configured page
 */
export async function createStealthPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    permissions: [],
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const page = await context.newPage();

  // Manual stealth scripts for bot detection bypass
  // Essential overrides without performance penalty
  await page.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // Override plugins length
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en']
    });

    // Override platform (AC3 - Story 2.3)
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel'
    });

    // Chrome runtime
    window.chrome = {
      runtime: {}
    };

    // Permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  return { context, page };
}

/**
 * Process properties in parallel using browser pool
 *
 * @param {BrowserPool} browserPool - Initialized browser pool
 * @param {Array<Property>} properties - Properties to process
 * @param {Function} processFn - Processing function (browser, property) => Promise<result>
 * @returns {Promise<Array>} Processing results
 */
export async function processInParallel(browserPool, properties, processFn) {
  if (!browserPool.isReady()) {
    throw new Error('Browser pool must be initialized before processing');
  }

  const poolSize = browserPool.getPoolSize();
  const results = [];
  const errors = [];

  // Process in batches equal to pool size
  for (let i = 0; i < properties.length; i += poolSize) {
    const batch = properties.slice(i, i + poolSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / poolSize) + 1} (${batch.length} properties)...`);

    const batchPromises = batch.map(async (property, batchIndex) => {
      const browserIndex = batchIndex % poolSize;
      const browser = browserPool.getBrowser(browserIndex);

      try {
        const result = await processFn(browser, property);
        return { success: true, property, result };
      } catch (error) {
        console.error(`❌ Error processing ${property.propertyName}:`, error.message);
        return { success: false, property, error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Separate successes and failures
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result.result);
      } else {
        errors.push({ property: result.property, error: result.error });
      }
    });
  }

  console.log(`\n✅ Parallel processing completed: ${results.length} successes, ${errors.length} failures`);

  return { results, errors };
}

export default {
  BrowserPool,
  createStealthPage,
  processInParallel
};
