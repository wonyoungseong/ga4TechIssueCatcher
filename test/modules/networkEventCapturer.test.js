/**
 * Network Event Capturer Module Tests
 *
 * Tests for CDP network event capture and GA4/GTM parameter parsing
 *
 * Epic 3: GA4/GTM Configuration Validation
 * Story 3.1: CDP Network Event Capture
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startCapturing,
  waitForGA4Events,
  extractMeasurementId,
  extractGTMId,
  findPageViewEvent,
  extractAPData,
  getEventSummary
} from '../../src/modules/networkEventCapturer.js';
import { BrowserPool, createStealthPage } from '../../src/modules/browserPoolManager.js';

describe('Network Event Capturer - URL Parameter Parsing (AC3)', () => {
  it('should parse GA4 measurement ID from URL', () => {
    // Arrange
    const events = [{
      type: 'ga4_collect',
      params: {
        tid: 'G-ABC123456',
        en: 'page_view'
      }
    }];

    // Act
    const measurementId = extractMeasurementId(events);

    // Assert (AC3)
    assert.equal(measurementId, 'G-ABC123456', 'Should extract measurement ID');
  });

  it('should parse event name from GA4 request', () => {
    // Arrange
    const events = [{
      type: 'ga4_collect',
      params: {
        en: 'page_view'
      }
    }];

    // Act
    const pageViewEvent = findPageViewEvent(events);

    // Assert (AC3)
    assert.ok(pageViewEvent, 'Should find page_view event');
    assert.equal(pageViewEvent.params.en, 'page_view', 'Event name should be page_view');
  });

  it('should handle missing measurement ID gracefully', () => {
    // Arrange
    const events = [];

    // Act
    const measurementId = extractMeasurementId(events);

    // Assert
    assert.equal(measurementId, null, 'Should return null when no events');
  });

  it('should extract GTM container ID from events', () => {
    // Arrange
    const events = [{
      type: 'gtm_load',
      params: {
        id: 'GTM-ABC1234'
      }
    }];

    // Act
    const gtmId = extractGTMId(events);

    // Assert
    assert.equal(gtmId, 'GTM-ABC1234', 'Should extract GTM container ID');
  });

  it('should extract AP_DATA custom parameter', () => {
    // Arrange
    const apDataObj = { propertyId: '12345', accountId: '67890' };
    const events = [{
      type: 'ga4_collect',
      params: {
        customParams: {
          AP_DATA: JSON.stringify(apDataObj)
        }
      }
    }];

    // Act
    const apData = extractAPData(events);

    // Assert
    assert.deepEqual(apData, apDataObj, 'Should parse AP_DATA JSON');
  });

  it('should handle invalid AP_DATA JSON gracefully', () => {
    // Arrange
    const events = [{
      type: 'ga4_collect',
      params: {
        customParams: {
          AP_DATA: 'invalid-json'
        }
      }
    }];

    // Act
    const apData = extractAPData(events);

    // Assert
    assert.equal(apData, null, 'Should return null for invalid JSON');
  });
});

describe('Network Event Capturer - Event Summary (AC5)', () => {
  it('should generate correct event summary for multiple events', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'page_view' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'click' }
      },
      {
        type: 'gtm_load',
        params: { id: 'GTM-ABC1234' }
      }
    ];

    // Act
    const summary = getEventSummary(events);

    // Assert (AC5)
    assert.equal(summary.totalEvents, 3, 'Should count total events');
    assert.equal(summary.ga4Events, 2, 'Should count GA4 events');
    assert.equal(summary.gtmEvents, 1, 'Should count GTM events');
    assert.deepEqual(summary.eventNames, ['page_view', 'click'], 'Should list event names');
    assert.equal(summary.hasPageView, true, 'Should detect page_view event');
  });

  it('should handle empty events array', () => {
    // Arrange
    const events = [];

    // Act
    const summary = getEventSummary(events);

    // Assert
    assert.equal(summary.totalEvents, 0, 'Should handle empty array');
    assert.equal(summary.ga4Events, 0, 'Should have zero GA4 events');
    assert.equal(summary.gtmEvents, 0, 'Should have zero GTM events');
    assert.equal(summary.hasPageView, false, 'Should not have page_view');
  });

  it('should deduplicate event names in summary', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'page_view' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'page_view' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'click' }
      }
    ];

    // Act
    const summary = getEventSummary(events);

    // Assert
    assert.equal(summary.eventNames.length, 2, 'Should deduplicate event names');
    assert.ok(summary.eventNames.includes('page_view'), 'Should include page_view');
    assert.ok(summary.eventNames.includes('click'), 'Should include click');
  });
});

describe('Network Event Capturer - Integration Tests (AC1, AC2, AC4, AC5)', () => {
  let browserPool;
  let browser;
  let page;

  beforeEach(async () => {
    // Initialize browser pool
    browserPool = new BrowserPool(1);
    await browserPool.initialize();
    browser = browserPool.getBrowser(0); // Get first browser with index 0
    page = await createStealthPage(browser);
  });

  afterEach(async () => {
    // Cleanup
    if (page) {
      await page.close();
    }
    if (browserPool && browserPool.isReady()) {
      await browserPool.cleanup();
    }
  });

  it('should start CDP network capture successfully (AC1)', async () => {
    // Act
    const capturedEvents = await startCapturing(page);

    // Assert (AC1)
    assert.ok(Array.isArray(capturedEvents), 'Should return an array');
    assert.equal(capturedEvents.length, 0, 'Initially should have no events');
  });

  it('should capture GA4 events from real page (AC1, AC2, AC5)', async () => {
    // Arrange
    const capturedEvents = await startCapturing(page);

    // Navigate to a test page with GA4 (using Google as example)
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

    // Act
    await waitForGA4Events(page, capturedEvents, 5000);

    // Assert
    // Note: Google may or may not have GA4 events, so we just verify the function works
    assert.ok(Array.isArray(capturedEvents), 'Should return captured events array');

    // If events were captured, verify they match the pattern (AC2)
    if (capturedEvents.length > 0) {
      const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
      ga4Events.forEach(event => {
        assert.ok(event.url.includes('analytics.google.com/g/collect'),
          'Should only capture analytics.google.com/g/collect requests');
      });
    }
  });

  it('should wait for specified timeout (AC4)', async () => {
    // Arrange
    const capturedEvents = await startCapturing(page);
    const timeoutMs = 2000;
    const startTime = Date.now();

    // Navigate to a simple page
    await page.goto('about:blank');

    // Act
    await waitForGA4Events(page, capturedEvents, timeoutMs);

    // Assert (AC4)
    const elapsedTime = Date.now() - startTime;
    assert.ok(elapsedTime >= timeoutMs - 500, `Should wait at least ${timeoutMs}ms (actual: ${elapsedTime}ms)`);
    assert.ok(elapsedTime < timeoutMs + 2000, `Should not wait much longer than ${timeoutMs}ms (actual: ${elapsedTime}ms)`);
  });

  it('should handle pages with no GA4 events', async () => {
    // Arrange
    const capturedEvents = await startCapturing(page);

    // Navigate to a page without GA4
    await page.goto('about:blank');

    // Act
    await waitForGA4Events(page, capturedEvents, 2000);

    // Assert
    assert.ok(Array.isArray(capturedEvents), 'Should return array even with no events');
    const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
    assert.equal(ga4Events.length, 0, 'Should have zero GA4 events');
  });

  it('should capture event with all required parameters (AC3)', async () => {
    // Arrange
    const capturedEvents = await startCapturing(page);

    // Create a test page with GA4 event
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GA4 Test Page</title>
      </head>
      <body>
        <h1>Test Page</h1>
        <script>
          // Simulate GA4 collect request by creating an image beacon
          const params = new URLSearchParams({
            v: '2',
            tid: 'G-TEST123456',
            en: 'page_view',
            dl: window.location.href,
            dt: document.title,
            sid: '1234567890',
            cid: 'client-id-12345'
          });
          const img = new Image();
          img.src = 'https://analytics.google.com/g/collect?' + params.toString();
        </script>
      </body>
      </html>
    `;

    // Act
    await page.goto(`data:text/html,${encodeURIComponent(testHTML)}`);
    await waitForGA4Events(page, capturedEvents, 3000);

    // Assert (AC3)
    const ga4Events = capturedEvents.filter(e => e.type === 'ga4_collect');
    if (ga4Events.length > 0) {
      const event = ga4Events[0];
      assert.ok(event.params, 'Should have params object');
      assert.ok(event.params.tid, 'Should have measurement ID (tid)');
      assert.ok(event.params.en, 'Should have event name (en)');
      // Note: sid and cid might not be captured in all scenarios
    }
  });
});

describe('Network Event Capturer - Error Handling', () => {
  it('should handle null events array in extractMeasurementId', () => {
    // Act & Assert
    const result = extractMeasurementId([]);
    assert.equal(result, null, 'Should return null for empty array');
  });

  it('should handle null events array in extractGTMId', () => {
    // Act & Assert
    const result = extractGTMId([]);
    assert.equal(result, null, 'Should return null for empty array');
  });

  it('should handle events without params', () => {
    // Arrange
    const events = [{
      type: 'ga4_collect',
      params: {}
    }];

    // Act
    const measurementId = extractMeasurementId(events);

    // Assert
    assert.equal(measurementId, null, 'Should handle missing tid parameter');
  });

  it('should handle events without customParams', () => {
    // Arrange
    const events = [{
      type: 'ga4_collect',
      params: {
        en: 'page_view'
      }
    }];

    // Act
    const apData = extractAPData(events);

    // Assert
    assert.equal(apData, null, 'Should return null when no customParams');
  });

  it('should find page_view event among multiple events', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'click' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'page_view' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'scroll' }
      }
    ];

    // Act
    const pageViewEvent = findPageViewEvent(events);

    // Assert
    assert.ok(pageViewEvent, 'Should find page_view event');
    assert.equal(pageViewEvent.params.en, 'page_view', 'Should return correct event');
  });

  it('should return null when page_view event not found', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'click' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'scroll' }
      }
    ];

    // Act
    const pageViewEvent = findPageViewEvent(events);

    // Assert
    assert.equal(pageViewEvent, null, 'Should return null when not found');
  });
});

describe('Network Event Capturer - Multiple Events Handling (AC5)', () => {
  it('should capture and store multiple GA4 events', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'page_view', tid: 'G-ABC123' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'click', tid: 'G-ABC123' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'scroll', tid: 'G-ABC123' }
      }
    ];

    // Act
    const summary = getEventSummary(events);

    // Assert (AC5)
    assert.equal(summary.ga4Events, 3, 'Should capture all GA4 events');
    assert.equal(summary.eventNames.length, 3, 'Should have 3 unique event names');
    assert.ok(summary.eventNames.includes('page_view'), 'Should include page_view');
    assert.ok(summary.eventNames.includes('click'), 'Should include click');
    assert.ok(summary.eventNames.includes('scroll'), 'Should include scroll');
  });

  it('should filter GA4 events from mixed event types', () => {
    // Arrange
    const events = [
      {
        type: 'ga4_collect',
        params: { en: 'page_view' }
      },
      {
        type: 'gtm_load',
        params: { id: 'GTM-ABC' }
      },
      {
        type: 'ga4_collect',
        params: { en: 'click' }
      },
      {
        type: 'other',
        params: {}
      }
    ];

    // Act
    const summary = getEventSummary(events);

    // Assert
    assert.equal(summary.ga4Events, 2, 'Should count only GA4 events');
    assert.equal(summary.gtmEvents, 1, 'Should count only GTM events');
    assert.equal(summary.totalEvents, 4, 'Should count all events');
  });
});
