/**
 * Unit Tests for Story 11.1 Phase 3: Extraction Source Tracking
 *
 * These tests verify that the extraction source tracking functionality
 * correctly identifies whether GA4 IDs were extracted from window object
 * or network events.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { extractMeasurementIdsWithSource } from '../../src/modules/networkEventCapturer.js';

test('extractMeasurementIdsWithSource - no GA4 events', () => {
  const events = [];
  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds, []);
  assert.deepStrictEqual(result.sources.window, []);
  assert.deepStrictEqual(result.sources.network, []);
  assert.deepStrictEqual(result.sources.mixed, []);
  assert.strictEqual(result.metrics.totalFound, 0);
  assert.strictEqual(result.metrics.windowExtracted, 0);
  assert.strictEqual(result.metrics.networkExtracted, 0);
  assert.strictEqual(result.metrics.primarySource, null);
});

test('extractMeasurementIdsWithSource - window-only extraction', () => {
  const events = [
    {
      type: 'ga4_collect',
      params: { tid: 'G-WINDOW123' },
      source: 'window_extraction'
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds, ['G-WINDOW123']);
  assert.deepStrictEqual(result.sources.window, ['G-WINDOW123']);
  assert.deepStrictEqual(result.sources.network, []);
  assert.deepStrictEqual(result.sources.mixed, []);
  assert.strictEqual(result.metrics.totalFound, 1);
  assert.strictEqual(result.metrics.windowExtracted, 1);
  assert.strictEqual(result.metrics.networkExtracted, 0);
  assert.strictEqual(result.metrics.primarySource, 'window');
});

test('extractMeasurementIdsWithSource - network-only extraction', () => {
  const events = [
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK456' },
      source: 'network'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK789' },
      // No source field should default to network
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds.sort(), ['G-NETWORK456', 'G-NETWORK789']);
  assert.deepStrictEqual(result.sources.window, []);
  assert.deepStrictEqual(result.sources.network.sort(), ['G-NETWORK456', 'G-NETWORK789']);
  assert.deepStrictEqual(result.sources.mixed, []);
  assert.strictEqual(result.metrics.totalFound, 2);
  assert.strictEqual(result.metrics.windowExtracted, 0);
  assert.strictEqual(result.metrics.networkExtracted, 2);
  assert.strictEqual(result.metrics.primarySource, 'network');
});

test('extractMeasurementIdsWithSource - mixed extraction (same ID from both sources)', () => {
  const events = [
    {
      type: 'ga4_collect',
      params: { tid: 'G-MIXED123' },
      source: 'window_extraction'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-MIXED123' },
      source: 'network'
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds, ['G-MIXED123']);
  assert.deepStrictEqual(result.sources.window, []);
  assert.deepStrictEqual(result.sources.network, []);
  assert.deepStrictEqual(result.sources.mixed, ['G-MIXED123']);
  assert.strictEqual(result.metrics.totalFound, 1);
  assert.strictEqual(result.metrics.windowExtracted, 1); // Mixed counts for both
  assert.strictEqual(result.metrics.networkExtracted, 1); // Mixed counts for both
  assert.strictEqual(result.metrics.primarySource, 'window'); // Window takes priority
});

test('extractMeasurementIdsWithSource - multiple IDs from different sources', () => {
  const events = [
    {
      type: 'ga4_collect',
      params: { tid: 'G-WINDOW1' },
      source: 'window_extraction'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-WINDOW2' },
      source: 'window_extraction'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK1' },
      source: 'network'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-MIXED1' },
      source: 'window_extraction'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-MIXED1' },
      source: 'network'
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.strictEqual(result.allIds.length, 4);
  assert.deepStrictEqual(result.sources.window.sort(), ['G-WINDOW1', 'G-WINDOW2']);
  assert.deepStrictEqual(result.sources.network, ['G-NETWORK1']);
  assert.deepStrictEqual(result.sources.mixed, ['G-MIXED1']);
  assert.strictEqual(result.metrics.totalFound, 4);
  assert.strictEqual(result.metrics.windowExtracted, 3); // 2 window + 1 mixed
  assert.strictEqual(result.metrics.networkExtracted, 2); // 1 network + 1 mixed
  assert.strictEqual(result.metrics.primarySource, 'window');
});

test('extractMeasurementIdsWithSource - filters non-GA4 events', () => {
  const events = [
    {
      type: 'gtm_load',
      params: { id: 'GTM-ABC123' }
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-VALID123' },
      source: 'window_extraction'
    },
    {
      type: 'consent_mode',
      params: {}
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds, ['G-VALID123']);
  assert.deepStrictEqual(result.sources.window, ['G-VALID123']);
  assert.strictEqual(result.metrics.totalFound, 1);
});

test('extractMeasurementIdsWithSource - handles events without params', () => {
  const events = [
    {
      type: 'ga4_collect',
      // Missing params
    },
    {
      type: 'ga4_collect',
      params: {
        // Missing tid
      }
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-VALID456' },
      source: 'network'
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.deepStrictEqual(result.allIds, ['G-VALID456']);
  assert.deepStrictEqual(result.sources.network, ['G-VALID456']);
  assert.strictEqual(result.metrics.totalFound, 1);
});

test('extractMeasurementIdsWithSource - prioritizes window for primarySource', () => {
  // Even if more IDs come from network, if any come from window, it's primary
  const events = [
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK1' },
      source: 'network'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK2' },
      source: 'network'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-NETWORK3' },
      source: 'network'
    },
    {
      type: 'ga4_collect',
      params: { tid: 'G-WINDOW1' },
      source: 'window_extraction'
    }
  ];

  const result = extractMeasurementIdsWithSource(events);

  assert.strictEqual(result.metrics.primarySource, 'window');
  assert.strictEqual(result.metrics.windowExtracted, 1);
  assert.strictEqual(result.metrics.networkExtracted, 3);
});

console.log('✅ All extraction source tracking tests passed!');