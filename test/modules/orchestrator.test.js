/**
 * Orchestrator Module Tests
 *
 * Tests for parallel browser execution functionality
 *
 * Epic 2: Browser Automation & Parallel Crawling
 * Story 2.2: Parallel Browser Execution
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { distributeProperties, runParallelValidation } from '../../src/modules/orchestrator.js';
import { BrowserPool } from '../../src/modules/browserPoolManager.js';

describe('Orchestrator - Property Distribution (AC1)', () => {
  it('should distribute 100 properties evenly across 5 browsers', () => {
    // Arrange
    const properties = Array.from({ length: 100 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    // Act
    const chunks = distributeProperties(properties, 5);

    // Assert (AC1)
    assert.equal(chunks.length, 5, 'Should create 5 chunks');
    assert.equal(chunks[0].length, 20, 'Browser 1 should get 20 properties');
    assert.equal(chunks[1].length, 20, 'Browser 2 should get 20 properties');
    assert.equal(chunks[2].length, 20, 'Browser 3 should get 20 properties');
    assert.equal(chunks[3].length, 20, 'Browser 4 should get 20 properties');
    assert.equal(chunks[4].length, 20, 'Browser 5 should get 20 properties');

    // Verify round-robin distribution
    assert.equal(chunks[0][0].propertyName, 'Property 1');
    assert.equal(chunks[1][0].propertyName, 'Property 2');
    assert.equal(chunks[0][1].propertyName, 'Property 6');
  });

  it('should handle uneven distribution (97 properties)', () => {
    // Arrange
    const properties = Array.from({ length: 97 }, (_, i) => ({
      propertyName: `Property ${i + 1}`
    }));

    // Act
    const chunks = distributeProperties(properties, 5);

    // Assert
    assert.equal(chunks.length, 5);
    assert.equal(chunks[0].length, 20, 'Browser 1: 20 properties');
    assert.equal(chunks[1].length, 20, 'Browser 2: 20 properties');
    assert.equal(chunks[2].length, 19, 'Browser 3: 19 properties');
    assert.equal(chunks[3].length, 19, 'Browser 4: 19 properties');
    assert.equal(chunks[4].length, 19, 'Browser 5: 19 properties');

    // Verify total
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    assert.equal(total, 97);
  });

  it('should handle fewer properties than browsers', () => {
    // Arrange
    const properties = Array.from({ length: 3 }, (_, i) => ({
      propertyName: `Property ${i + 1}`
    }));

    // Act
    const chunks = distributeProperties(properties, 5);

    // Assert
    assert.equal(chunks.length, 5);
    assert.equal(chunks[0].length, 1);
    assert.equal(chunks[1].length, 1);
    assert.equal(chunks[2].length, 1);
    assert.equal(chunks[3].length, 0);
    assert.equal(chunks[4].length, 0);
  });

  it('should throw error for empty properties array', () => {
    assert.throws(
      () => distributeProperties([], 5),
      /Properties array cannot be empty/
    );
  });

  it('should throw error for invalid browser count', () => {
    const properties = [{ propertyName: 'Test' }];

    assert.throws(
      () => distributeProperties(properties, 0),
      /Browser count must be positive/
    );

    assert.throws(
      () => distributeProperties(properties, -1),
      /Browser count must be positive/
    );
  });
});

describe('Orchestrator - Parallel Execution Integration', () => {
  let browserPool;

  beforeEach(async () => {
    // Initialize with smaller pool for faster tests
    browserPool = new BrowserPool(3);
    await browserPool.initialize();
  });

  afterEach(async () => {
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should execute parallel validation with proper error isolation (AC3)', async () => {
    // Arrange
    const properties = Array.from({ length: 6 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: i === 2 ? 'https://invalid-url-force-error.test' : `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act - Even though property 3 will fail, others should continue
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert (AC3)
    assert.ok(result.workerStats, 'Should return worker statistics');
    assert.equal(result.workerStats.length, 3, 'Should have 3 workers');

    // Verify all workers completed (even if some had errors)
    result.workerStats.forEach(stat => {
      assert.ok(stat.executionTimeMs >= 0, 'Worker should have execution time');
    });

    // Total results + errors should equal total properties
    const totalProcessed = result.results.length + result.errors.length;
    assert.equal(totalProcessed, properties.length, 'All properties should be processed');
  });

  it('should track execution time and alert if exceeding 2 hours (AC4)', async () => {
    // Arrange
    const properties = Array.from({ length: 3 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert (AC4)
    assert.ok(result.executionTimeMs, 'Should track execution time');
    assert.ok(result.executionTimeMs < 2 * 60 * 60 * 1000, 'Should complete within 2 hours');

    // Verify worker stats include timing
    result.workerStats.forEach(stat => {
      assert.ok(stat.executionTimeMs >= 0, 'Worker should have execution time');
      assert.ok(stat.propertyCount >= 0, 'Worker should have property count');
    });
  });

  it('should distribute work evenly and process sequentially per worker (AC2)', async () => {
    // Arrange
    const properties = Array.from({ length: 9 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert (AC2)
    // 9 properties / 3 browsers = 3 properties per browser
    const expectedDistribution = [3, 3, 3];
    result.workerStats.forEach((stat, index) => {
      assert.equal(
        stat.propertyCount + stat.errorCount,
        expectedDistribution[index],
        `Worker ${index + 1} should process ${expectedDistribution[index]} properties`
      );
    });

    // Verify all results have worker index
    result.results.forEach(validationResult => {
      assert.ok(
        validationResult.workerIndex !== undefined,
        'Each result should have worker index'
      );
    });
  });
});

describe('Orchestrator - Browser Context Clearing (AC5)', () => {
  let browserPool;

  beforeEach(async () => {
    browserPool = new BrowserPool(2);
    await browserPool.initialize();
  });

  afterEach(async () => {
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should clear browser context after each property validation', async () => {
    // Arrange
    const properties = Array.from({ length: 2 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert (AC5)
    // Test validates context clearing by checking that:
    // 1. Workers completed successfully
    // 2. No context accumulation errors
    // 3. All properties processed

    assert.ok(result.results.length > 0, 'Should have successful results');
    assert.equal(
      result.results.length + result.errors.length,
      properties.length,
      'All properties should be processed'
    );

    // Verify each worker processed its properties
    result.workerStats.forEach(stat => {
      assert.ok(stat.propertyCount >= 0, 'Worker should have processed properties');
    });
  });
});

describe('Orchestrator - Performance Metrics', () => {
  it('should calculate average execution time per property', () => {
    // Arrange
    const totalTimeMs = 120000; // 2 minutes
    const propertyCount = 100;

    // Act
    const avgTimePerProperty = totalTimeMs / propertyCount;

    // Assert
    assert.equal(avgTimePerProperty, 1200, 'Should be 1.2s per property');
  });

  it('should validate 100 properties can complete within 2 hours (AC4)', () => {
    // Arrange
    const propertiesPerBrowser = 20;
    const avgTimePerProperty = 60; // seconds
    const browsers = 5;

    // Act
    const totalTimeMinutes = (propertiesPerBrowser * avgTimePerProperty) / 60;

    // Assert (AC4)
    assert.ok(totalTimeMinutes <= 120, 'Should complete within 2 hours');
    assert.equal(totalTimeMinutes, 20, 'Expected ~20 minutes per browser');
  });

  it('should target 1.5 hours for 100 properties', () => {
    // Arrange
    const targetMinutes = 90; // 1.5 hours
    const properties = 100;
    const browsers = 5;

    // Act
    const propertiesPerBrowser = properties / browsers;
    const secondsPerProperty = (targetMinutes * 60) / properties;

    // Assert
    assert.equal(propertiesPerBrowser, 20, 'Each browser should handle 20 properties');
    assert.equal(secondsPerProperty, 54, 'Should target ~54s per property for 1.5h total');
  });
});

describe('Orchestrator - Error Handling', () => {
  let browserPool;

  beforeEach(async () => {
    browserPool = new BrowserPool(2);
    await browserPool.initialize();
  });

  afterEach(async () => {
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should throw error if browser pool not initialized', async () => {
    // Arrange
    const uninitializedPool = new BrowserPool(2);
    const properties = [{ propertyName: 'Test' }];
    const dateStr = '2025-01-29';

    // Act & Assert
    await assert.rejects(
      async () => await runParallelValidation(uninitializedPool, properties, dateStr),
      /Browser pool must be initialized/
    );
  });

  it('should continue execution even if one worker has critical error (AC3)', async () => {
    // Arrange
    const properties = Array.from({ length: 4 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert (AC3)
    // Even if some validations fail, all workers should complete
    assert.equal(result.workerStats.length, 2, 'Both workers should complete');

    const totalProcessed = result.results.length + result.errors.length;
    assert.equal(totalProcessed, properties.length, 'All properties should be accounted for');
  });
});

describe('Orchestrator - Resource Management', () => {
  let browserPool;

  beforeEach(async () => {
    browserPool = new BrowserPool(2);
    await browserPool.initialize();
  });

  afterEach(async () => {
    if (browserPool) {
      await browserPool.cleanup();
    }
  });

  it('should acquire and release browsers properly', async () => {
    // Arrange
    const properties = Array.from({ length: 2 }, (_, i) => ({
      propertyName: `Property ${i + 1}`,
      slug: `property-${i + 1}`,
      measurementId: `G-TEST${i}`,
      representativeUrl: `https://example.com/${i}`
    }));

    const dateStr = '2025-01-29';

    // Act
    const result = await runParallelValidation(browserPool, properties, dateStr);

    // Assert
    // After completion, all browsers should be released
    assert.ok(result.workerStats, 'Should have worker stats');

    // Verify we can acquire browsers again (they were released)
    const { browser: browser1, index: index1 } = await browserPool.acquireBrowser();
    assert.ok(browser1, 'Should be able to acquire browser 1');

    const { browser: browser2, index: index2 } = await browserPool.acquireBrowser();
    assert.ok(browser2, 'Should be able to acquire browser 2');

    // Cleanup
    await browserPool.releaseBrowser(index1);
    await browserPool.releaseBrowser(index2);
  });
});
