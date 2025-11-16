/**
 * Retry Logic Module Tests
 *
 * Tests for retry logic with exponential backoff
 *
 * Epic 6: Error Recovery & Retry Logic
 * Story 6.1: Retry Logic with Exponential Backoff
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { retryWithBackoff, isRetryableError } from '../../src/modules/orchestrator.js';

describe('Retry Logic - Error Classification (AC5, AC6)', () => {
  it('should classify network timeout as retryable', () => {
    // Arrange
    const error = new Error('Navigation timeout of 30000 ms exceeded');

    // Act
    const result = isRetryableError(error);

    // Assert (AC5)
    assert.equal(result, true, 'Network timeout should be retryable');
  });

  it('should classify ETIMEDOUT as retryable', () => {
    // Arrange
    const error = new Error('connect ETIMEDOUT 192.168.1.1:443');

    // Act
    const result = isRetryableError(error);

    // Assert (AC5)
    assert.equal(result, true, 'ETIMEDOUT should be retryable');
  });

  it('should classify ERR_CONNECTION_REFUSED as retryable', () => {
    // Arrange
    const error = new Error('net::ERR_CONNECTION_REFUSED at https://example.com');

    // Act
    const result = isRetryableError(error);

    // Assert (AC5)
    assert.equal(result, true, 'Connection refused should be retryable');
  });

  it('should classify HTTP 5xx errors as retryable', () => {
    // Arrange
    const error500 = new Error('HTTP error 500: Internal Server Error');
    const error503 = new Error('Request failed with status code 503');

    // Act
    const result500 = isRetryableError(error500);
    const result503 = isRetryableError(error503);

    // Assert (AC5)
    assert.equal(result500, true, 'HTTP 500 should be retryable');
    assert.equal(result503, true, 'HTTP 503 should be retryable');
  });

  it('should classify page crashed as retryable', () => {
    // Arrange
    const error = new Error('Page crashed!');

    // Act
    const result = isRetryableError(error);

    // Assert (AC5)
    assert.equal(result, true, 'Page crash should be retryable');
  });

  it('should classify measurement ID mismatch as non-retryable', () => {
    // Arrange
    const error = new Error('Measurement ID mismatch: expected G-ABC123, got G-XYZ789');

    // Act
    const result = isRetryableError(error);

    // Assert (AC6)
    assert.equal(result, false, 'Measurement ID mismatch should not be retryable');
  });

  it('should classify GTM ID mismatch as non-retryable', () => {
    // Arrange
    const error = new Error('GTM ID mismatch: expected GTM-ABC123, got GTM-XYZ789');

    // Act
    const result = isRetryableError(error);

    // Assert (AC6)
    assert.equal(result, false, 'GTM ID mismatch should not be retryable');
  });

  it('should classify measurement ID not found as non-retryable', () => {
    // Arrange
    const error = new Error('Measurement ID not found in captured events');

    // Act
    const result = isRetryableError(error);

    // Assert (AC6)
    assert.equal(result, false, 'Measurement ID not found should not be retryable');
  });

  it('should classify invalid configuration as non-retryable', () => {
    // Arrange
    const error = new Error('Invalid configuration: missing required field');

    // Act
    const result = isRetryableError(error);

    // Assert (AC6)
    assert.equal(result, false, 'Invalid configuration should not be retryable');
  });

  it('should classify unknown errors as non-retryable by default', () => {
    // Arrange
    const error = new Error('Some unknown error occurred');

    // Act
    const result = isRetryableError(error);

    // Assert
    assert.equal(result, false, 'Unknown errors should default to non-retryable');
  });
});

describe('Retry Logic - Retry with Exponential Backoff (AC1, AC2, AC4)', () => {
  it('should succeed on first attempt without retrying', async () => {
    // Arrange
    let attemptCount = 0;
    const successFn = async () => {
      attemptCount++;
      return 'success';
    };

    // Act
    const startTime = Date.now();
    const result = await retryWithBackoff(successFn, 3, 100, 'test');
    const elapsedTime = Date.now() - startTime;

    // Assert
    assert.equal(result, 'success', 'Should return success result');
    assert.equal(attemptCount, 1, 'Should only attempt once');
    assert.ok(elapsedTime < 200, 'Should not wait for backoff on success');
  });

  it('should retry up to 3 times with exponential backoff (AC1, AC2)', async () => {
    // Arrange
    let attemptCount = 0;
    const timestamps = [];
    const retryableFn = async () => {
      attemptCount++;
      timestamps.push(Date.now());

      if (attemptCount < 3) {
        throw new Error('Navigation timeout of 30000 ms exceeded'); // Retryable error
      }
      return 'success';
    };

    // Act
    const startTime = Date.now();
    const result = await retryWithBackoff(retryableFn, 3, 100, 'test');

    // Assert (AC1)
    assert.equal(result, 'success', 'Should eventually succeed');
    assert.equal(attemptCount, 3, 'Should attempt 3 times total');

    // Verify exponential backoff timing (AC2)
    // First retry: ~100ms after first attempt
    // Second retry: ~200ms after second attempt
    const firstBackoff = timestamps[1] - timestamps[0];
    const secondBackoff = timestamps[2] - timestamps[1];

    assert.ok(firstBackoff >= 100 && firstBackoff < 300, `First backoff should be ~100ms (was ${firstBackoff}ms)`);
    assert.ok(secondBackoff >= 200 && secondBackoff < 400, `Second backoff should be ~200ms (was ${secondBackoff}ms)`);
  });

  it('should throw error after exhausting all retries (AC3)', async () => {
    // Arrange
    let attemptCount = 0;
    const alwaysFailFn = async () => {
      attemptCount++;
      throw new Error('ETIMEDOUT: Connection timeout'); // Retryable error
    };

    // Act & Assert (AC3)
    await assert.rejects(
      async () => {
        await retryWithBackoff(alwaysFailFn, 3, 100, 'test');
      },
      {
        name: 'Error',
        message: 'ETIMEDOUT: Connection timeout'
      },
      'Should throw error after all retries exhausted'
    );

    // Verify it attempted 4 times total (initial + 3 retries)
    assert.equal(attemptCount, 4, 'Should attempt 4 times (initial + 3 retries)');
  });

  it('should not retry non-retryable errors (AC6)', async () => {
    // Arrange
    let attemptCount = 0;
    const nonRetryableFn = async () => {
      attemptCount++;
      throw new Error('Measurement ID mismatch'); // Non-retryable error
    };

    // Act & Assert (AC6)
    await assert.rejects(
      async () => {
        await retryWithBackoff(nonRetryableFn, 3, 100, 'test');
      },
      {
        name: 'Error',
        message: 'Measurement ID mismatch'
      },
      'Should throw non-retryable error immediately'
    );

    // Verify it only attempted once
    assert.equal(attemptCount, 1, 'Should not retry non-retryable errors');
  });

  it('should use correct backoff intervals: 1s, 2s, 4s (AC2)', async () => {
    // Arrange
    let attemptCount = 0;
    const timestamps = [];
    const retryableFn = async () => {
      attemptCount++;
      timestamps.push(Date.now());
      throw new Error('timeout'); // Retryable error
    };

    // Act
    try {
      await retryWithBackoff(retryableFn, 3, 1000, 'test');
    } catch (error) {
      // Expected to fail after all retries
    }

    // Assert (AC2) - Check actual backoff intervals
    // Attempt 1 -> wait 1s -> Attempt 2 -> wait 2s -> Attempt 3 -> wait 4s -> Attempt 4
    assert.equal(attemptCount, 4, 'Should attempt 4 times');

    if (timestamps.length >= 4) {
      const backoff1 = timestamps[1] - timestamps[0];
      const backoff2 = timestamps[2] - timestamps[1];
      const backoff3 = timestamps[3] - timestamps[2];

      // Allow 20% tolerance for timing variations
      assert.ok(backoff1 >= 1000 && backoff1 < 1200, `First backoff should be ~1000ms (was ${backoff1}ms)`);
      assert.ok(backoff2 >= 2000 && backoff2 < 2400, `Second backoff should be ~2000ms (was ${backoff2}ms)`);
      assert.ok(backoff3 >= 4000 && backoff3 < 4800, `Third backoff should be ~4000ms (was ${backoff3}ms)`);
    }
  });

  it('should handle async function results correctly', async () => {
    // Arrange
    const asyncFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { data: 'test result', status: 'ok' };
    };

    // Act
    const result = await retryWithBackoff(asyncFn, 3, 100, 'test');

    // Assert
    assert.deepEqual(result, { data: 'test result', status: 'ok' }, 'Should return async function result');
  });

  it('should include context in retry logs (AC4)', async () => {
    // Arrange
    let attemptCount = 0;
    const contextName = 'Test Property Name';
    const retryableFn = async () => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('timeout');
      }
      return 'success';
    };

    // Act
    // Note: This test verifies the function accepts context parameter
    // Actual log output verification would require log capture
    const result = await retryWithBackoff(retryableFn, 3, 100, contextName);

    // Assert
    assert.equal(result, 'success', 'Should succeed with context');
    assert.equal(attemptCount, 2, 'Should retry once before success');
  });
});

describe('Retry Logic - Edge Cases', () => {
  it('should handle zero retries configuration', async () => {
    // Arrange
    let attemptCount = 0;
    const failFn = async () => {
      attemptCount++;
      throw new Error('timeout');
    };

    // Act & Assert
    await assert.rejects(
      async () => {
        await retryWithBackoff(failFn, 0, 100, 'test');
      },
      'Should throw error with zero retries'
    );

    assert.equal(attemptCount, 1, 'Should only attempt once with zero retries');
  });

  it('should handle custom base backoff time', async () => {
    // Arrange
    let attemptCount = 0;
    const timestamps = [];
    const retryableFn = async () => {
      attemptCount++;
      timestamps.push(Date.now());
      if (attemptCount < 2) {
        throw new Error('timeout');
      }
      return 'success';
    };

    // Act
    await retryWithBackoff(retryableFn, 3, 500, 'test'); // 500ms base backoff

    // Assert
    assert.equal(attemptCount, 2, 'Should succeed on second attempt');

    if (timestamps.length >= 2) {
      const backoff = timestamps[1] - timestamps[0];
      assert.ok(backoff >= 500 && backoff < 700, `Backoff should be ~500ms (was ${backoff}ms)`);
    }
  });

  it('should handle empty context string', async () => {
    // Arrange
    const successFn = async () => 'success';

    // Act
    const result = await retryWithBackoff(successFn, 3, 100, '');

    // Assert
    assert.equal(result, 'success', 'Should handle empty context');
  });

  it('should handle function that returns null', async () => {
    // Arrange
    const nullFn = async () => null;

    // Act
    const result = await retryWithBackoff(nullFn, 3, 100, 'test');

    // Assert
    assert.equal(result, null, 'Should return null if function returns null');
  });

  it('should handle function that returns undefined', async () => {
    // Arrange
    const undefinedFn = async () => undefined;

    // Act
    const result = await retryWithBackoff(undefinedFn, 3, 100, 'test');

    // Assert
    assert.equal(result, undefined, 'Should return undefined if function returns undefined');
  });
});
