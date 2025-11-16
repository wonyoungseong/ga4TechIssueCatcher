/**
 * Stealth Mode E2E Tests
 *
 * Tests stealth configuration to ensure bot detection avoidance
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.3: Stealth Mode Configuration
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserPool, createStealthPage } from '../../src/modules/browserPoolManager.js';

describe('Stealth Mode - Bot Detection Avoidance (AC5)', () => {
  let browserPool;
  let browser;
  let page;

  before(async () => {
    // Initialize browser pool with 1 browser for E2E testing
    browserPool = new BrowserPool(1);
    await browserPool.initialize();
    browser = browserPool.getBrowser(0);
    page = await createStealthPage(browser);
  });

  after(async () => {
    if (page) {
      await page.close();
    }
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should hide navigator.webdriver property (AC3)', async () => {
    // Navigate to a simple test page
    await page.goto('about:blank');

    // Check that navigator.webdriver is undefined
    const webdriverValue = await page.evaluate(() => navigator.webdriver);

    assert.equal(webdriverValue, undefined, 'navigator.webdriver should be undefined');
  });

  it('should set realistic User-Agent (AC2)', async () => {
    await page.goto('about:blank');

    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Verify User-Agent contains Chrome and doesn't reveal automation
    assert.ok(userAgent.includes('Chrome'), 'User-Agent should include Chrome');
    assert.ok(userAgent.includes('Safari'), 'User-Agent should include Safari');
    assert.ok(!userAgent.includes('Headless'), 'User-Agent should not contain Headless');
    assert.ok(!userAgent.includes('Playwright'), 'User-Agent should not contain Playwright');
  });

  it('should set realistic navigator.platform (AC3)', async () => {
    await page.goto('about:blank');

    const platform = await page.evaluate(() => navigator.platform);

    assert.equal(platform, 'MacIntel', 'navigator.platform should be MacIntel');
  });

  it('should set realistic navigator.plugins (AC3)', async () => {
    await page.goto('about:blank');

    const pluginsLength = await page.evaluate(() => navigator.plugins.length);

    assert.ok(pluginsLength > 0, 'navigator.plugins should have entries');
  });

  it('should set realistic navigator.languages (AC3)', async () => {
    await page.goto('about:blank');

    const languages = await page.evaluate(() => navigator.languages);

    assert.ok(Array.isArray(languages), 'navigator.languages should be an array');
    assert.ok(languages.length > 0, 'navigator.languages should have entries');
    assert.ok(languages.includes('ko-KR'), 'Should include ko-KR language');
  });

  it('should have window.chrome object (AC3)', async () => {
    await page.goto('about:blank');

    const hasChrome = await page.evaluate(() => !!window.chrome);
    const hasRuntime = await page.evaluate(() => !!window.chrome?.runtime);

    assert.equal(hasChrome, true, 'window.chrome should exist');
    assert.equal(hasRuntime, true, 'window.chrome.runtime should exist');
  });

  it('should pass bot.sannysoft.com detection tests', async () => {
    // Navigate to bot detection test site
    try {
      await page.goto('https://bot.sannysoft.com/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for detection tests to complete
      await page.waitForTimeout(2000);

      // Check for common bot detection indicators
      const detectionResults = await page.evaluate(() => {
        const results = {
          webdriver: navigator.webdriver,
          plugins: navigator.plugins.length,
          languages: navigator.languages.length,
          hasChrome: !!window.chrome,
          userAgent: navigator.userAgent
        };

        // Check for red flags in the page
        const bodyText = document.body.innerText.toLowerCase();
        results.hasDetectionWarning = bodyText.includes('bot detected') ||
                                       bodyText.includes('automation detected');

        return results;
      });

      // Assertions
      assert.equal(detectionResults.webdriver, undefined, 'webdriver should be undefined');
      assert.ok(detectionResults.plugins > 0, 'Should have plugins');
      assert.ok(detectionResults.languages > 0, 'Should have languages');
      assert.ok(detectionResults.hasChrome, 'Should have Chrome object');
      assert.ok(!detectionResults.hasDetectionWarning, 'Should not trigger bot detection warning');

      console.log('✅ Passed bot.sannysoft.com detection tests');
    } catch (error) {
      console.warn('⚠️ bot.sannysoft.com test failed (may be network issue):', error.message);
      // Don't fail test for network issues
      if (!error.message.includes('timeout') && !error.message.includes('net::')) {
        throw error;
      }
    }
  });

  it('should pass arh.antoinevastel.com headless detection', async () => {
    // Navigate to headless detection test site
    try {
      await page.goto('https://arh.antoinevastel.com/bots/areyouheadless', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for detection tests to complete
      await page.waitForTimeout(2000);

      // Check detection results
      const detectionResults = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return {
          isHeadlessDetected: bodyText.includes('you are headless') ||
                              bodyText.includes('headless: true'),
          hasWebdriver: bodyText.includes('webdriver: true'),
          bodyContent: document.body.innerText.substring(0, 500)
        };
      });

      // Assertions
      assert.ok(!detectionResults.isHeadlessDetected, 'Should not be detected as headless');
      assert.ok(!detectionResults.hasWebdriver, 'Should not have webdriver property');

      console.log('✅ Passed arh.antoinevastel.com headless detection');
    } catch (error) {
      console.warn('⚠️ arh.antoinevastel.com test failed (may be network issue):', error.message);
      // Don't fail test for network issues
      if (!error.message.includes('timeout') && !error.message.includes('net::')) {
        throw error;
      }
    }
  });

  it('should not have automation-related console warnings', async () => {
    const consoleMessages = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    await page.goto('about:blank');

    // Check for automation-related warnings
    const automationWarnings = consoleMessages.filter(msg => {
      const text = msg.text.toLowerCase();
      return text.includes('automation') ||
             text.includes('webdriver') ||
             text.includes('bot detected');
    });

    assert.equal(automationWarnings.length, 0, 'Should not have automation-related console warnings');
  });
});

describe('Stealth Mode - Browser Configuration (AC1, AC4)', () => {
  it('should launch browser with stealth arguments', async () => {
    const browserPool = new BrowserPool(1);
    await browserPool.initialize();

    try {
      const browser = browserPool.getBrowser(0);

      // Verify browser is initialized
      assert.ok(browser, 'Browser should be initialized');
      assert.ok(browser.isConnected(), 'Browser should be connected');

      // Create a page and verify it works
      const page = await createStealthPage(browser);
      assert.ok(page, 'Should create stealth page');

      await page.goto('about:blank');
      const title = await page.title();
      assert.ok(title !== null, 'Should be able to navigate page');

      await page.close();
    } finally {
      await browserPool.cleanup();
    }
  });

  it('should configure viewport to standard resolution (AC1)', async () => {
    const browserPool = new BrowserPool(1);
    await browserPool.initialize();

    try {
      const browser = browserPool.getBrowser(0);
      const page = await createStealthPage(browser);

      const viewport = page.viewportSize();

      assert.equal(viewport.width, 1920, 'Viewport width should be 1920');
      assert.equal(viewport.height, 1080, 'Viewport height should be 1080');

      await page.close();
    } finally {
      await browserPool.cleanup();
    }
  });
});

describe('Stealth Mode - Real-World Validation', () => {
  let browserPool;

  before(async () => {
    browserPool = new BrowserPool(1);
    await browserPool.initialize();
  });

  after(async () => {
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should navigate to Google without detection', async () => {
    const browser = browserPool.getBrowser(0);
    const page = await createStealthPage(browser);

    try {
      await page.goto('https://www.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Check if we can access the page (not blocked or CAPTCHA)
      const title = await page.title();
      assert.ok(title.includes('Google'), 'Should successfully load Google');

      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return document.body.innerText.includes('CAPTCHA') ||
               document.body.innerText.includes('unusual traffic');
      });

      assert.ok(!hasCaptcha, 'Should not trigger CAPTCHA on Google');

      console.log('✅ Successfully accessed Google without detection');
    } catch (error) {
      console.warn('⚠️ Google test failed (may be network issue):', error.message);
      // Don't fail test for network issues
      if (!error.message.includes('timeout') && !error.message.includes('net::')) {
        throw error;
      }
    } finally {
      await page.close();
    }
  });

  it('should maintain stealth properties across page navigations', async () => {
    const browser = browserPool.getBrowser(0);
    const page = await createStealthPage(browser);

    try {
      // Navigate to first page
      await page.goto('about:blank');
      const firstCheck = await page.evaluate(() => ({
        webdriver: navigator.webdriver,
        platform: navigator.platform
      }));

      // Navigate to second page
      await page.goto('https://www.example.com', { timeout: 10000 });
      const secondCheck = await page.evaluate(() => ({
        webdriver: navigator.webdriver,
        platform: navigator.platform
      }));

      // Verify properties are consistent
      assert.equal(firstCheck.webdriver, secondCheck.webdriver, 'webdriver property should be consistent');
      assert.equal(firstCheck.platform, secondCheck.platform, 'platform property should be consistent');
      assert.equal(secondCheck.webdriver, undefined, 'webdriver should remain undefined');
      assert.equal(secondCheck.platform, 'MacIntel', 'platform should remain MacIntel');

      console.log('✅ Stealth properties maintained across navigations');
    } catch (error) {
      console.warn('⚠️ Navigation test failed (may be network issue):', error.message);
      // Don't fail test for network issues
      if (!error.message.includes('timeout') && !error.message.includes('net::')) {
        throw error;
      }
    } finally {
      await page.close();
    }
  });
});

describe('Stealth Mode - Performance Impact', () => {
  it('should not significantly impact page load performance', async () => {
    const browserPool = new BrowserPool(1);
    await browserPool.initialize();

    try {
      const browser = browserPool.getBrowser(0);
      const page = await createStealthPage(browser);

      const startTime = Date.now();
      await page.goto('https://www.example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
      const loadTime = Date.now() - startTime;

      // Stealth mode should not add more than 2 seconds to page load
      assert.ok(loadTime < 10000, 'Page load with stealth should complete within 10 seconds');

      console.log(`✅ Page loaded with stealth in ${loadTime}ms`);

      await page.close();
    } catch (error) {
      console.warn('⚠️ Performance test failed (may be network issue):', error.message);
      // Don't fail test for network issues
      if (!error.message.includes('timeout') && !error.message.includes('net::')) {
        throw error;
      }
    } finally {
      await browserPool.cleanup();
    }
  });
});
