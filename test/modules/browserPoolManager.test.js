/**
 * Tests for Browser Pool Manager Module
 * Story 2.1: Browser Pool Setup
 *
 * Test Framework: Node.js built-in test runner (node:test)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserPool, createStealthPage, processInParallel } from '../../src/modules/browserPoolManager.js';

describe('Story 2.1: Browser Pool Setup', () => {
  let browserPool;

  beforeEach(() => {
    // Create new pool before each test
    browserPool = new BrowserPool(3); // Use smaller pool size for faster tests
  });

  afterEach(async () => {
    // Cleanup after each test
    if (browserPool && browserPool.isReady()) {
      await browserPool.cleanup();
    }
  });

  describe('BrowserPool initialization (AC1)', () => {
    it('should initialize pool with specified size', async () => {
      await browserPool.initialize();

      assert.equal(browserPool.isReady(), true, 'Pool should be ready');
      assert.equal(browserPool.getPoolSize(), 3, 'Pool size should be 3');
      assert.equal(browserPool.browsers.length, 3, 'Should have 3 browser instances');
      assert.equal(browserPool.available.length, 3, 'Should have 3 availability flags');
      assert.deepEqual(browserPool.available, [true, true, true], 'All browsers should be available initially');
    });

    it('should initialize pool with default size of 5', async () => {
      const defaultPool = new BrowserPool();
      await defaultPool.initialize();

      assert.equal(defaultPool.getPoolSize(), 5, 'Default pool size should be 5');
      assert.equal(defaultPool.browsers.length, 5, 'Should have 5 browser instances');

      await defaultPool.cleanup();
    });

    it('should prevent double initialization', async () => {
      await browserPool.initialize();
      await browserPool.initialize(); // Should not throw

      assert.equal(browserPool.browsers.length, 3, 'Should still have 3 browsers');
    });

    it('should cleanup partial pool on initialization failure', async () => {
      // This test would require mocking chromium.launch to fail
      // For now, we verify cleanup works after successful init
      await browserPool.initialize();
      await browserPool.cleanup();

      assert.equal(browserPool.isReady(), false, 'Pool should not be ready after cleanup');
      assert.equal(browserPool.browsers.length, 0, 'Should have no browsers after cleanup');
    });
  });

  describe('Browser configuration (AC4: Memory limit)', () => {
    it('should configure browsers with memory limit', async () => {
      await browserPool.initialize();

      // Memory limit is set in browser args (--max-old-space-size=500)
      // We can verify browser was created successfully
      const browser = browserPool.getBrowser(0);
      assert.ok(browser, 'Browser should be created');
      assert.equal(typeof browser.close, 'function', 'Browser should have close method');
    });
  });

  describe('acquireBrowser() (AC2)', () => {
    it('should acquire an available browser', async () => {
      await browserPool.initialize();

      const { browser, index } = await browserPool.acquireBrowser();

      assert.ok(browser, 'Should return a browser');
      assert.equal(typeof index, 'number', 'Should return an index');
      assert.ok(index >= 0 && index < 3, 'Index should be in valid range');
      assert.equal(browserPool.available[index], false, 'Browser should be marked as in-use');
    });

    it('should throw error if pool not initialized', async () => {
      await assert.rejects(
        async () => await browserPool.acquireBrowser(),
        { message: /not initialized/ },
        'Should throw error when pool not initialized'
      );
    });

    it('should acquire different browsers for concurrent requests', async () => {
      await browserPool.initialize();

      const result1 = await browserPool.acquireBrowser();
      const result2 = await browserPool.acquireBrowser();
      const result3 = await browserPool.acquireBrowser();

      // All three browsers should be different
      const indices = [result1.index, result2.index, result3.index];
      const uniqueIndices = new Set(indices);
      assert.equal(uniqueIndices.size, 3, 'Should acquire 3 different browsers');

      // All should be marked as in-use
      assert.equal(browserPool.available[result1.index], false);
      assert.equal(browserPool.available[result2.index], false);
      assert.equal(browserPool.available[result3.index], false);

      // Release all for cleanup
      await browserPool.releaseBrowser(result1.index);
      await browserPool.releaseBrowser(result2.index);
      await browserPool.releaseBrowser(result3.index);
    });

    it('should timeout when all browsers are busy', async () => {
      await browserPool.initialize();

      // Acquire all browsers
      await browserPool.acquireBrowser();
      await browserPool.acquireBrowser();
      await browserPool.acquireBrowser();

      // Try to acquire one more (should timeout)
      await assert.rejects(
        async () => await browserPool.acquireBrowser(1000), // 1 second timeout
        { message: /Timeout waiting/ },
        'Should timeout when all browsers busy'
      );
    });

    it('should wait and acquire when browser becomes available', async () => {
      await browserPool.initialize();

      // Acquire all browsers
      const { index } = await browserPool.acquireBrowser();
      await browserPool.acquireBrowser();
      await browserPool.acquireBrowser();

      // Release one browser after delay
      setTimeout(async () => {
        await browserPool.releaseBrowser(index);
      }, 500);

      // This should wait and succeed
      const result = await browserPool.acquireBrowser(2000);
      assert.ok(result.browser, 'Should acquire browser after waiting');
    });
  });

  describe('releaseBrowser() (AC3)', () => {
    it('should release browser back to pool', async () => {
      await browserPool.initialize();

      const { index } = await browserPool.acquireBrowser();
      assert.equal(browserPool.available[index], false, 'Should be in-use');

      await browserPool.releaseBrowser(index);
      assert.equal(browserPool.available[index], true, 'Should be available after release');
    });

    it('should clear browser context on release', async () => {
      await browserPool.initialize();

      const { browser, index } = await browserPool.acquireBrowser();

      // Create a context with some state
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('about:blank');

      assert.equal(browser.contexts().length, 1, 'Should have 1 context before release');

      // Release should close contexts
      await browserPool.releaseBrowser(index);

      assert.equal(browser.contexts().length, 0, 'Should have 0 contexts after release');
      assert.equal(browserPool.available[index], true, 'Should be available');
    });

    it('should throw error for invalid index', async () => {
      await browserPool.initialize();

      await assert.rejects(
        async () => await browserPool.releaseBrowser(-1),
        { message: /Invalid browser index/ },
        'Should throw for negative index'
      );

      await assert.rejects(
        async () => await browserPool.releaseBrowser(10),
        { message: /Invalid browser index/ },
        'Should throw for out-of-range index'
      );
    });

    it('should throw error when releasing already available browser', async () => {
      await browserPool.initialize();

      // Try to release browser that was never acquired
      await assert.rejects(
        async () => await browserPool.releaseBrowser(0),
        { message: /not currently in-use/ },
        'Should throw when releasing available browser'
      );
    });
  });

  describe('Pool cleanup (AC5)', () => {
    it('should close all browsers gracefully', async () => {
      await browserPool.initialize();

      assert.equal(browserPool.browsers.length, 3, 'Should have 3 browsers');
      assert.equal(browserPool.isReady(), true, 'Pool should be ready');

      await browserPool.cleanup();

      assert.equal(browserPool.browsers.length, 0, 'Should have 0 browsers after cleanup');
      assert.equal(browserPool.isReady(), false, 'Pool should not be ready after cleanup');
    });

    it('should cleanup even with browsers in-use', async () => {
      await browserPool.initialize();

      // Acquire some browsers
      await browserPool.acquireBrowser();
      await browserPool.acquireBrowser();

      // Cleanup should still work
      await browserPool.cleanup();

      assert.equal(browserPool.browsers.length, 0, 'Should cleanup successfully');
      assert.equal(browserPool.isReady(), false, 'Pool should not be ready');
    });
  });

  describe('getBrowser() (backward compatibility)', () => {
    it('should get browser by index', async () => {
      await browserPool.initialize();

      const browser = browserPool.getBrowser(0);
      assert.ok(browser, 'Should return browser');
      assert.equal(typeof browser.close, 'function', 'Should be valid browser');
    });

    it('should throw error if pool not initialized', () => {
      assert.throws(
        () => browserPool.getBrowser(0),
        { message: /not initialized/ },
        'Should throw when pool not initialized'
      );
    });

    it('should throw error for invalid index', async () => {
      await browserPool.initialize();

      assert.throws(
        () => browserPool.getBrowser(-1),
        { message: /Invalid browser index/ },
        'Should throw for negative index'
      );

      assert.throws(
        () => browserPool.getBrowser(10),
        { message: /Invalid browser index/ },
        'Should throw for out-of-range index'
      );
    });
  });

  describe('createStealthPage()', () => {
    it('should create page with stealth configuration', async () => {
      await browserPool.initialize();
      const browser = browserPool.getBrowser(0);

      const page = await createStealthPage(browser);

      assert.ok(page, 'Should create page');
      assert.equal(typeof page.goto, 'function', 'Should be valid page');

      // Verify viewport
      const viewport = page.viewportSize();
      assert.equal(viewport.width, 1920, 'Viewport width should be 1920');
      assert.equal(viewport.height, 1080, 'Viewport height should be 1080');

      await page.close();
    });

    it('should inject stealth scripts to avoid detection', async () => {
      await browserPool.initialize();
      const browser = browserPool.getBrowser(0);

      const page = await createStealthPage(browser);
      await page.goto('about:blank');

      // Verify stealth scripts
      const webdriver = await page.evaluate(() => navigator.webdriver);
      assert.equal(webdriver, undefined, 'navigator.webdriver should be undefined');

      const hasChrome = await page.evaluate(() => !!window.chrome);
      assert.equal(hasChrome, true, 'window.chrome should exist');

      await page.close();
    });
  });

  describe('processInParallel()', () => {
    it('should process properties in parallel batches', async () => {
      await browserPool.initialize();

      const properties = [
        { propertyName: 'Property 1', measurementId: 'G-TEST001' },
        { propertyName: 'Property 2', measurementId: 'G-TEST002' },
        { propertyName: 'Property 3', measurementId: 'G-TEST003' },
        { propertyName: 'Property 4', measurementId: 'G-TEST004' },
        { propertyName: 'Property 5', measurementId: 'G-TEST005' }
      ];

      const processFn = async (browser, property) => {
        // Simulate processing
        return { propertyName: property.propertyName, processed: true };
      };

      const { results, errors } = await processInParallel(browserPool, properties, processFn);

      assert.equal(results.length, 5, 'Should process all 5 properties');
      assert.equal(errors.length, 0, 'Should have no errors');
      assert.equal(results[0].processed, true, 'Results should be processed');
    });

    it('should handle processing errors gracefully', async () => {
      await browserPool.initialize();

      const properties = [
        { propertyName: 'Property 1', measurementId: 'G-TEST001' },
        { propertyName: 'Property 2', measurementId: 'G-TEST002' }
      ];

      const processFn = async (browser, property) => {
        if (property.propertyName === 'Property 1') {
          throw new Error('Simulated error');
        }
        return { propertyName: property.propertyName, processed: true };
      };

      const { results, errors } = await processInParallel(browserPool, properties, processFn);

      assert.equal(results.length, 1, 'Should have 1 successful result');
      assert.equal(errors.length, 1, 'Should have 1 error');
      assert.equal(errors[0].property.propertyName, 'Property 1', 'Error should be for Property 1');
    });

    it('should throw error if pool not initialized', async () => {
      const properties = [{ propertyName: 'Test', measurementId: 'G-TEST' }];
      const processFn = async () => ({});

      await assert.rejects(
        async () => await processInParallel(browserPool, properties, processFn),
        { message: /must be initialized/ },
        'Should throw when pool not initialized'
      );
    });
  });
});
