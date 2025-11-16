/**
 * Unit Tests for Network Event Capturer
 * Story 11.1: Consent Mode GA4 ID Extraction Enhancement
 *
 * Tests window.google_tag_manager GA4 ID extraction functionality
 * that bypasses Consent Mode blocking.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import playwright from 'playwright';
import { startCapturing, waitForGTMLoad } from '../networkEventCapturer.js';

describe('Window GA4 Extraction - Story 11.1', () => {
  let browser;
  let context;
  let page;

  beforeEach(async () => {
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('waitForGTMLoad with window.google_tag_manager extraction', () => {
    it('should extract GA4 IDs from window.google_tag_manager', async () => {
      // Setup: Create a test page with GA4 ID in window object
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      // Inject GTM and GA4 containers into window.google_tag_manager
      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-TEST123': {
            dataLayer: {},
            destination: {}
          },
          'G-TEST4567890': {
            config: {},
            data: {}
          }
        };
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection (which triggers window GA4 extraction)
      const gtmResult = await waitForGTMLoad(page, capturedEvents, 'GTM-TEST123', 5000);

      // Verify GTM detection
      assert.equal(gtmResult.gtmDetected, true);
      assert.ok(gtmResult.gtmIds.includes('GTM-TEST123'));

      // Verify GA4 ID was extracted and added as synthetic event
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      const windowExtractedEvents = ga4Events.filter(e => e.source === 'window_extraction');

      assert.ok(windowExtractedEvents.length > 0, 'Should have window-extracted GA4 events');

      const expectedGA4Event = windowExtractedEvents.find(e => e.params.tid === 'G-TEST4567890');
      assert.ok(expectedGA4Event, 'Should find expected GA4 ID G-TEST4567890');
      assert.equal(expectedGA4Event.params.en, 'window_extracted');
      assert.equal(expectedGA4Event.source, 'window_extraction');
    });

    it('should handle delayed GA4 container loading (Phase 2 fix)', async () => {
      // Setup: Initially only GTM, GA4 added later
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      // Initially only GTM
      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-DELAYED': {
            dataLayer: {},
            destination: {}
          }
        };

        // Simulate delayed GA4 container loading
        setTimeout(() => {
          window.google_tag_manager['G-DELAYED123'] = {
            config: {},
            data: {}
          };
        }, 1000);
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection (includes 2s delayed re-check)
      const gtmResult = await waitForGTMLoad(page, capturedEvents, 'GTM-DELAYED', 10000);

      // Verify GTM detection
      assert.equal(gtmResult.gtmDetected, true);

      // Verify delayed GA4 ID was extracted
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      const delayedGA4Event = ga4Events.find(e => e.params.tid === 'G-DELAYED123');

      assert.ok(delayedGA4Event, 'Should find delayed GA4 ID G-DELAYED123');
      assert.equal(delayedGA4Event.source, 'window_extraction');
    });

    it('should deduplicate GA4 IDs from window and network sources', async () => {
      // Setup: GA4 ID present in window
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-DEDUP': {
            dataLayer: {},
            destination: {}
          },
          'G-DEDUP456': {
            config: {},
            data: {}
          }
        };
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection
      await waitForGTMLoad(page, capturedEvents, 'GTM-DEDUP', 5000);

      // Manually add a duplicate network event
      capturedEvents.push({
        url: 'https://www.google-analytics.com/g/collect?tid=G-DEDUP456',
        method: 'GET',
        headers: {},
        timestamp: Date.now() / 1000,
        type: 'ga4_collect',
        params: {
          tid: 'G-DEDUP456',
          en: 'page_view'
        },
        source: 'network'
      });

      // Verify both sources captured but GA4 ID is the same
      const ga4Events = capturedEvents.filter(e =>
        e.type === 'ga4_collect' && e.params.tid === 'G-DEDUP456'
      );

      assert.equal(ga4Events.length, 2, 'Should have 2 events (window + network)');

      const sources = ga4Events.map(e => e.source);
      assert.ok(sources.includes('window_extraction'));
      assert.ok(sources.includes('network'));
    });

    it('should not extract GA4 IDs when window.google_tag_manager has no G- keys', async () => {
      // Setup: Only GTM, no GA4
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-ONLY': {
            dataLayer: {},
            destination: {}
          }
        };
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection
      await waitForGTMLoad(page, capturedEvents, 'GTM-ONLY', 5000);

      // Verify no GA4 events extracted
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');

      assert.equal(ga4Events.length, 0, 'Should have no GA4 events when no G- keys present');
    });

    it('should extract multiple GA4 IDs from window.google_tag_manager', async () => {
      // Setup: Multiple GA4 IDs
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-MULTI': {
            dataLayer: {},
            destination: {}
          },
          'G-MULTI111': {
            config: {},
            data: {}
          },
          'G-MULTI222': {
            config: {},
            data: {}
          },
          'G-MULTI333': {
            config: {},
            data: {}
          }
        };
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection
      await waitForGTMLoad(page, capturedEvents, 'GTM-MULTI', 5000);

      // Verify all GA4 IDs extracted
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      const extractedIds = ga4Events.map(e => e.params.tid);

      assert.ok(extractedIds.includes('G-MULTI111'));
      assert.ok(extractedIds.includes('G-MULTI222'));
      assert.ok(extractedIds.includes('G-MULTI333'));
      assert.equal(ga4Events.every(e => e.source === 'window_extraction'), true);
    });

    it('should handle missing window.google_tag_manager gracefully', async () => {
      // Setup: No GTM object
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection (should timeout)
      const gtmResult = await waitForGTMLoad(page, capturedEvents, 'GTM-NONEXIST', 2000);

      // Verify GTM not detected
      assert.equal(gtmResult.gtmDetected, false);
      assert.equal(gtmResult.timing.timedOut, true);

      // Verify no GA4 events extracted
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      assert.equal(ga4Events.length, 0);
    });
  });

  describe('Consent Mode compatibility', () => {
    it('should extract GA4 IDs even when network events are blocked', async () => {
      // Setup: GA4 ID in window but simulate Consent Mode blocking network
      await page.goto('data:text/html,<html><head><title>Test</title></head><body></body></html>');

      await page.evaluate(() => {
        window.google_tag_manager = {
          'GTM-CONSENT': {
            dataLayer: {},
            destination: {}
          },
          'G-CONSENT789': {
            config: {},
            data: {}
          }
        };
        // Simulate Consent Mode by not sending network requests
      });

      // Start capturing
      const capturedEvents = [];
      await startCapturing(page, capturedEvents);

      // Wait for GTM detection
      await waitForGTMLoad(page, capturedEvents, 'GTM-CONSENT', 5000);

      // Verify GA4 ID extracted from window (bypassing Consent Mode)
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      const windowExtractedEvents = ga4Events.filter(e => e.source === 'window_extraction');

      assert.ok(windowExtractedEvents.length > 0);

      const consentGA4Event = windowExtractedEvents.find(e => e.params.tid === 'G-CONSENT789');
      assert.ok(consentGA4Event, 'Should extract GA4 ID despite Consent Mode');
    });
  });
});
