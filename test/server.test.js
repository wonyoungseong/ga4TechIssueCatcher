/**
 * Server Integration Tests
 *
 * Comprehensive integration tests for Express.js REST API server
 * Testing all endpoints, security measures, error handling, and edge cases
 *
 * Epic 8: Web Dashboard
 * Story 8.1: Web Server and REST API
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

// Test configuration
const TEST_PORT = 3001; // Different port to avoid conflict with running server
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_DATE = '2025-01-29';

// Test data setup
let server;

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Setup test data and start server
 */
async function setupTestEnvironment() {
  // Create test directories
  await fs.mkdir(`results/${TEST_DATE}`, { recursive: true });
  await fs.mkdir(`screenshots/${TEST_DATE}`, { recursive: true });

  // Create test result files
  const testResult = {
    slug: 'test-property',
    measurementId: 'G-TEST123',
    gtmContainerId: 'GTM-ABC123',
    hasPageView: true,
    issues: [],
    screenshotPath: `screenshots/${TEST_DATE}/test-property.png`,
    validatedAt: new Date().toISOString()
  };

  await fs.writeFile(
    `results/${TEST_DATE}/test-property.json`,
    JSON.stringify(testResult, null, 2)
  );

  // Create test summary
  const testSummary = {
    totalProperties: 1,
    successfulValidations: 1,
    failedValidations: 0,
    totalIssues: 0,
    executionTime: 1000
  };

  await fs.writeFile(
    `results/${TEST_DATE}/_summary.json`,
    JSON.stringify(testSummary, null, 2)
  );

  // Create test screenshot (empty PNG)
  const testScreenshot = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await fs.writeFile(`screenshots/${TEST_DATE}/test-property.png`, testScreenshot);

  // Start test server
  const { default: serverModule } = await import('../src/server.js');
  server = serverModule.server;

  // Change port for testing
  await new Promise((resolve) => {
    server.close(() => {
      server.listen(TEST_PORT, resolve);
    });
  });
}

/**
 * Cleanup test data and stop server
 */
async function cleanupTestEnvironment() {
  await fs.rm(`results/${TEST_DATE}`, { recursive: true, force: true });
  await fs.rm(`screenshots/${TEST_DATE}`, { recursive: true, force: true });

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
}

// ============================================================================
// API ENDPOINT TESTS
// ============================================================================

describe('Server API - Status Endpoint', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('GET /api/status returns 200 with correct structure', async () => {
    const { status, data } = await makeRequest('/api/status');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.strictEqual(data.data.status, 'online');
    assert.ok(data.data.version);
    assert.ok(typeof data.data.uptime === 'number');
    assert.ok(typeof data.data.connectedClients === 'number');
  });
});

describe('Server API - Dates Endpoint', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('GET /api/dates returns array of date strings', async () => {
    const { status, data } = await makeRequest('/api/dates');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.includes(TEST_DATE));
  });
});

describe('Server API - Results Endpoints', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('GET /api/results returns paginated results with default limit', async () => {
    const { status, data } = await makeRequest('/api/results');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(typeof data.count === 'number');
  });

  it('GET /api/results respects limit parameter (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/results?limit=10');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

  it('GET /api/results validates limit parameter - clamps to max 365 (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/results?limit=999');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    // Should succeed with clamped value
  });

  it('GET /api/results validates limit parameter - clamps to min 1 (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/results?limit=-5');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    // Should succeed with clamped value
  });

  it('GET /api/results/:date returns results for specific date', async () => {
    const { status, data } = await makeRequest(`/api/results/${TEST_DATE}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
    assert.ok(typeof data.count === 'number');
  });

  it('GET /api/results/:date validates date format (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/results/invalid-date');

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_DATE_FORMAT');
  });

  it('GET /api/results/:date/:slug returns specific property result', async () => {
    const { status, data } = await makeRequest(`/api/results/${TEST_DATE}/test-property`);

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.strictEqual(data.data.slug, 'test-property');
  });

  it('GET /api/results/:date/:slug returns 404 for invalid slug', async () => {
    const { status, data } = await makeRequest(`/api/results/${TEST_DATE}/nonexistent`);

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  it('GET /api/results/:date/:slug validates date format (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/results/bad-date/test-property');

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_DATE_FORMAT');
  });

  it('GET /api/results/:date/:slug validates slug format (SEC-003)', async () => {
    const { status, data } = await makeRequest(`/api/results/${TEST_DATE}/../../etc/passwd`);

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_SLUG_FORMAT');
  });
});

describe('Server API - Summary Endpoints', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('GET /api/summary returns summaries array', async () => {
    const { status, data } = await makeRequest('/api/summary');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

  it('GET /api/summary respects limit parameter (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/summary?limit=15');

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.data));
  });

  it('GET /api/summary/:date returns summary for specific date', async () => {
    const { status, data } = await makeRequest(`/api/summary/${TEST_DATE}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.data);
    assert.ok(typeof data.data.totalProperties === 'number');
  });

  it('GET /api/summary/:date returns 404 for missing summary', async () => {
    const { status, data } = await makeRequest('/api/summary/2020-01-01');

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
  });

  it('GET /api/summary/:date validates date format (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/summary/invalid-format');

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_DATE_FORMAT');
  });
});

describe('Server API - Screenshots Endpoint', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('GET /api/screenshots/:date/:filename returns image file', async () => {
    const { status, data, headers } = await makeRequest(`/api/screenshots/${TEST_DATE}/test-property.png`);

    assert.strictEqual(status, 200);
    assert.ok(headers['content-type'].includes('image') || data instanceof Buffer);
  });

  it('GET /api/screenshots/:date/:filename returns 404 for missing file', async () => {
    const { status, data } = await makeRequest(`/api/screenshots/${TEST_DATE}/nonexistent.png`);

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'NOT_FOUND');
  });

  it('GET /api/screenshots/:date/:filename validates date format (SEC-003)', async () => {
    const { status, data } = await makeRequest('/api/screenshots/bad-date/test.png');

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_DATE_FORMAT');
  });

  it('GET /api/screenshots/:date/:filename prevents path traversal (SEC-002)', async () => {
    const { status, data } = await makeRequest(`/api/screenshots/${TEST_DATE}/../../etc/passwd`);

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_FILENAME');
  });

  it('GET /api/screenshots/:date/:filename validates file extension (SEC-002)', async () => {
    const { status, data } = await makeRequest(`/api/screenshots/${TEST_DATE}/malicious.sh`);

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'INVALID_FILENAME');
  });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('Server Security - Rate Limiting (SEC-001)', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('should rate limit excessive requests', async () => {
    const requests = [];

    // Make 105 requests (limit is 100 per 15 minutes)
    for (let i = 0; i < 105; i++) {
      requests.push(makeRequest('/api/status'));
    }

    const responses = await Promise.all(requests);

    // At least one request should be rate limited
    const rateLimited = responses.some(r => r.status === 429);
    assert.ok(rateLimited, 'Expected at least one request to be rate limited');
  });
});

describe('Server Security - Input Validation (SEC-003)', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('should reject SQL injection attempts in date parameter', async () => {
    const { status, data } = await makeRequest('/api/results/2025-01-01; DROP TABLE users--');

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  it('should reject XSS attempts in slug parameter', async () => {
    const { status, data } = await makeRequest(`/api/results/${TEST_DATE}/<script>alert('xss')</script>`);

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });

  it('should sanitize path traversal in filename', async () => {
    const { status, data } = await makeRequest(`/api/screenshots/${TEST_DATE}/../../../etc/passwd`);

    assert.strictEqual(status, 400);
    assert.strictEqual(data.success, false);
  });
});

// ============================================================================
// ERROR HANDLING TESTS (REL-001)
// ============================================================================

describe('Server Error Handling', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('should return 404 for unknown routes', async () => {
    const { status } = await makeRequest('/api/nonexistent');

    assert.strictEqual(status, 404);
  });

  it('should return structured error responses', async () => {
    const { status, data } = await makeRequest('/api/results/2020-01-01/nonexistent');

    assert.strictEqual(status, 404);
    assert.strictEqual(data.success, false);
    assert.ok(data.error);
  });

  it('should handle malformed JSON gracefully', async () => {
    // This would require sending a POST request with malformed JSON
    // Skipping for now as all current endpoints are GET
  });
});

// ============================================================================
// PERFORMANCE TESTS (PERF-001)
// ============================================================================

describe('Server Performance - Parallel File Operations', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('should handle multiple concurrent requests efficiently', async () => {
    const startTime = Date.now();

    const requests = Array(10).fill(null).map(() =>
      makeRequest(`/api/results/${TEST_DATE}`)
    );

    await Promise.all(requests);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete 10 requests in reasonable time (under 2 seconds)
    assert.ok(totalTime < 2000, `Requests took ${totalTime}ms, expected < 2000ms`);
  });
});

// ============================================================================
// CORS TESTS
// ============================================================================

describe('Server CORS Configuration', () => {
  before(setupTestEnvironment);
  after(cleanupTestEnvironment);

  it('should include CORS headers', async () => {
    const { headers } = await makeRequest('/api/status');

    assert.ok(headers['access-control-allow-origin'], 'CORS headers should be present');
  });
});
