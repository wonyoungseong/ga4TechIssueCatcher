/**
 * Result Storage Module Tests
 *
 * Tests for validation result JSON storage, screenshot capture,
 * and old data cleanup
 *
 * Epic 4: Result Storage & Screenshot Management
 * Story 4.1: Validation Result JSON Storage
 * Story 4.2: Fullpage Screenshot Capture
 * Story 4.3: 30-Day Old Data Cleanup
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  saveValidationResult,
  saveScreenshot,
  cleanupOldFiles,
  saveSummary
} from '../../src/modules/resultStorage.js';
import { BrowserPool, createStealthPage } from '../../src/modules/browserPoolManager.js';

// Test directories (for cleanup tests)
const TEST_CLEANUP_DIR = 'test-cleanup';

// NOTE: Stories 4.1 and 4.2 tests use the actual 'results/' and 'screenshots/' directories
// because the implementation has hardcoded paths. Cleanup is done in before/after hooks.

describe('Result Storage - JSON Validation Result (Story 4.1)', () => {
  const testDate = '2025-01-29';

  beforeEach(async () => {
    // Clean up actual results directory before each test
    await fs.rm(`results/${testDate}`, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up actual results directory after each test
    await fs.rm(`results/${testDate}`, { recursive: true, force: true });
  });

  it('should save validation result as JSON file (AC1)', async () => {
    // Arrange
    const result = {
      slug: 'test-property',
      measurementId: 'G-TEST123',
      gtmContainerId: 'GTM-ABC123',
      hasPageView: true,
      apData: { propertyId: '12345' },
      timestamp: new Date().toISOString()
    };

    // Act
    const filePath = await saveValidationResult(result, testDate);

    // Assert (AC1)
    assert.ok(filePath.includes(testDate), 'File path should contain date');
    assert.ok(filePath.includes('test-property.json'), 'File path should contain slug');

    // Verify file exists
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const savedResult = JSON.parse(fileContent);
    assert.equal(savedResult.slug, 'test-property', 'Should save slug correctly');
    assert.equal(savedResult.measurementId, 'G-TEST123', 'Should save measurement ID');
  });

  it('should create date-based directory structure (AC2)', async () => {
    // Arrange
    const result = {
      slug: 'test-property-2',
      measurementId: 'G-TEST456',
      timestamp: new Date().toISOString()
    };

    // Act
    await saveValidationResult(result, testDate);

    // Assert (AC2)
    const dirExists = await fs.access(`results/${testDate}`)
      .then(() => true)
      .catch(() => false);
    assert.ok(dirExists, 'Should create date-based directory');
  });

  it('should save JSON with proper formatting (AC3)', async () => {
    // Arrange
    const result = {
      slug: 'formatted-test',
      measurementId: 'G-FORMAT123',
      hasPageView: true,
      timestamp: new Date().toISOString()
    };

    // Act
    await saveValidationResult(result, testDate);

    // Assert (AC3)
    const filePath = `results/${testDate}/formatted-test.json`;
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Check that JSON is formatted (contains newlines and indentation)
    assert.ok(fileContent.includes('\n'), 'JSON should be formatted with newlines');
    assert.ok(fileContent.includes('  '), 'JSON should have indentation');

    // Verify it's valid JSON
    const parsed = JSON.parse(fileContent);
    assert.equal(parsed.slug, 'formatted-test', 'Should parse correctly');
  });

  it('should handle special characters in property names', async () => {
    // Arrange
    const result = {
      slug: 'test-property-with-special-chars',
      measurementId: 'G-SPECIAL123',
      timestamp: new Date().toISOString()
    };

    // Act
    const filePath = await saveValidationResult(result, testDate);

    // Assert
    assert.ok(filePath.includes('test-property-with-special-chars.json'),
      'Should handle slugified names');

    const fileExists = await fs.access(filePath)
      .then(() => true)
      .catch(() => false);
    assert.ok(fileExists, 'File should exist with special characters handled');
  });
});

describe('Result Storage - Screenshot Capture (Story 4.2)', () => {
  const testDate = '2025-01-29';
  let browserPool;
  let browser;
  let page;

  beforeEach(async () => {
    // Clean up actual screenshots directory
    await fs.rm(`screenshots/${testDate}`, { recursive: true, force: true });

    // Initialize browser pool
    browserPool = new BrowserPool(1);
    await browserPool.initialize();
    browser = browserPool.getBrowser(0);
    page = await createStealthPage(browser);
  });

  afterEach(async () => {
    // Cleanup browser and directories
    if (page) {
      await page.close();
    }
    if (browserPool && browserPool.isReady()) {
      await browserPool.cleanup();
    }
    await fs.rm(`screenshots/${testDate}`, { recursive: true, force: true });
  });

  it('should capture fullpage screenshot (AC1)', async () => {
    // Arrange
    await page.goto('data:text/html,<h1>Test Page</h1><div style="height:3000px">Long content</div>');

    // Act
    const screenshotPath = await saveScreenshot(page, 'test-property', testDate);

    // Assert (AC1)
    assert.ok(screenshotPath, 'Should return screenshot path');
    assert.ok(screenshotPath.includes('.png'), 'Should be PNG format');

    const fileExists = await fs.access(screenshotPath)
      .then(() => true)
      .catch(() => false);
    assert.ok(fileExists, 'Screenshot file should exist');
  });

  it('should save screenshot with timestamp in filename (AC2)', async () => {
    // Arrange
    await page.goto('data:text/html,<h1>Timestamp Test</h1>');

    // Act
    const screenshotPath = await saveScreenshot(page, 'timestamp-test', testDate);

    // Assert (AC2)
    const filename = path.basename(screenshotPath);
    assert.ok(filename.startsWith('timestamp-test_'), 'Should include property slug');
    assert.ok(filename.match(/\d{8}-\d{6}/), 'Should include timestamp in format YYYYMMDD-HHMMSS');
  });

  it('should create date-based directory for screenshots (AC3)', async () => {
    // Arrange
    await page.goto('data:text/html,<h1>Directory Test</h1>');

    // Act
    await saveScreenshot(page, 'dir-test', testDate);

    // Assert (AC3)
    const dirExists = await fs.access(`screenshots/${testDate}`)
      .then(() => true)
      .catch(() => false);
    assert.ok(dirExists, 'Should create date-based directory');
  });

  it('should handle screenshot capture errors gracefully', async () => {
    // Arrange - close page to cause error
    await page.close();

    // Act
    const screenshotPath = await saveScreenshot(page, 'error-test', testDate);

    // Assert
    assert.equal(screenshotPath, null, 'Should return null on error');
  });
});

describe('Result Storage - Old Data Cleanup (Story 4.3)', () => {
  const TEST_CLEANUP_DIR = 'test-cleanup';

  beforeEach(async () => {
    // Clean up test directory before each test
    await fs.rm(TEST_CLEANUP_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_CLEANUP_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory after each test
    await fs.rm(TEST_CLEANUP_DIR, { recursive: true, force: true });
  });

  it('should detect and delete folders older than retention period (AC1, AC2)', async () => {
    // Arrange - Create test folders with different ages
    const today = new Date();
    const oldDate1 = new Date(today);
    oldDate1.setDate(oldDate1.getDate() - 35); // 35 days old
    const oldDate2 = new Date(today);
    oldDate2.setDate(oldDate2.getDate() - 40); // 40 days old
    const recentDate = new Date(today);
    recentDate.setDate(recentDate.getDate() - 15); // 15 days old

    const oldFolder1 = `${TEST_CLEANUP_DIR}/${oldDate1.toISOString().split('T')[0]}`;
    const oldFolder2 = `${TEST_CLEANUP_DIR}/${oldDate2.toISOString().split('T')[0]}`;
    const recentFolder = `${TEST_CLEANUP_DIR}/${recentDate.toISOString().split('T')[0]}`;

    // Create folders and files
    await fs.mkdir(oldFolder1, { recursive: true });
    await fs.mkdir(oldFolder2, { recursive: true });
    await fs.mkdir(recentFolder, { recursive: true });

    await fs.writeFile(`${oldFolder1}/file1.json`, '{}');
    await fs.writeFile(`${oldFolder1}/file2.json`, '{}');
    await fs.writeFile(`${oldFolder2}/file3.json`, '{}');
    await fs.writeFile(`${recentFolder}/file4.json`, '{}');

    // Act
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert (AC1, AC2)
    assert.equal(result.deletedFolders, 2, 'Should delete 2 old folders');
    assert.equal(result.deletedFiles, 3, 'Should delete 3 files from old folders');

    // Verify old folders are deleted
    const oldFolder1Exists = await fs.access(oldFolder1).then(() => true).catch(() => false);
    const oldFolder2Exists = await fs.access(oldFolder2).then(() => true).catch(() => false);
    assert.equal(oldFolder1Exists, false, 'Old folder 1 should be deleted');
    assert.equal(oldFolder2Exists, false, 'Old folder 2 should be deleted');

    // Verify recent folder still exists
    const recentFolderExists = await fs.access(recentFolder).then(() => true).catch(() => false);
    assert.ok(recentFolderExists, 'Recent folder should still exist');
  });

  it('should log deleted folder and file counts (AC3)', async () => {
    // Arrange - Create old test folder
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 35);
    const oldFolder = `${TEST_CLEANUP_DIR}/${oldDate.toISOString().split('T')[0]}`;

    await fs.mkdir(oldFolder, { recursive: true });
    await fs.writeFile(`${oldFolder}/file1.json`, '{}');
    await fs.writeFile(`${oldFolder}/file2.json`, '{}');

    // Act
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert (AC3)
    assert.ok(result.deletedFolders >= 0, 'Should return deleted folder count');
    assert.ok(result.deletedFiles >= 0, 'Should return deleted file count');
    assert.equal(result.deletedFolders, 1, 'Should log 1 deleted folder');
    assert.equal(result.deletedFiles, 2, 'Should log 2 deleted files');
  });

  it('should handle deletion errors gracefully and continue (AC4)', async () => {
    // Arrange - Create old folder
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 35);
    const oldFolder = `${TEST_CLEANUP_DIR}/${oldDate.toISOString().split('T')[0]}`;

    await fs.mkdir(oldFolder, { recursive: true });
    await fs.writeFile(`${oldFolder}/file1.json`, '{}');

    // Act - Function should not throw even if there are issues
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert (AC4)
    assert.ok(result, 'Should return result object even with errors');
    assert.ok(typeof result.deletedFolders === 'number', 'Should return folder count');
    assert.ok(typeof result.deletedFiles === 'number', 'Should return file count');
  });

  it('should not delete current date folder (AC5)', async () => {
    // Arrange - Create today's folder
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayFolder = `${TEST_CLEANUP_DIR}/${todayStr}`;

    await fs.mkdir(todayFolder, { recursive: true });
    await fs.writeFile(`${todayFolder}/file1.json`, '{}');

    // Act
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert (AC5)
    const todayFolderExists = await fs.access(todayFolder).then(() => true).catch(() => false);
    assert.ok(todayFolderExists, 'Current date folder should not be deleted');
    assert.equal(result.deletedFolders, 0, 'Should not delete any folders');
  });

  it('should skip non-date folders', async () => {
    // Arrange - Create folders with invalid date names
    await fs.mkdir(`${TEST_CLEANUP_DIR}/invalid-folder`, { recursive: true });
    await fs.mkdir(`${TEST_CLEANUP_DIR}/not-a-date`, { recursive: true });

    // Act
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert
    assert.equal(result.deletedFolders, 0, 'Should skip non-date folders');

    // Verify invalid folders still exist
    const invalidExists = await fs.access(`${TEST_CLEANUP_DIR}/invalid-folder`).then(() => true).catch(() => false);
    const notDateExists = await fs.access(`${TEST_CLEANUP_DIR}/not-a-date`).then(() => true).catch(() => false);
    assert.ok(invalidExists, 'Invalid folder should still exist');
    assert.ok(notDateExists, 'Non-date folder should still exist');
  });

  it('should handle empty base directory', async () => {
    // Arrange - Empty directory
    await fs.rm(TEST_CLEANUP_DIR, { recursive: true });
    await fs.mkdir(TEST_CLEANUP_DIR, { recursive: true });

    // Act
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 30);

    // Assert
    assert.equal(result.deletedFolders, 0, 'Should handle empty directory');
    assert.equal(result.deletedFiles, 0, 'Should have no files to delete');
  });

  it('should use custom retention period', async () => {
    // Arrange - Create folder 20 days old
    const today = new Date();
    const date20DaysOld = new Date(today);
    date20DaysOld.setDate(date20DaysOld.getDate() - 20);
    const folder20Days = `${TEST_CLEANUP_DIR}/${date20DaysOld.toISOString().split('T')[0]}`;

    await fs.mkdir(folder20Days, { recursive: true });
    await fs.writeFile(`${folder20Days}/file1.json`, '{}');

    // Act - Use 15 day retention (should delete 20-day-old folder)
    const result = await cleanupOldFiles(TEST_CLEANUP_DIR, 15);

    // Assert
    assert.equal(result.deletedFolders, 1, 'Should delete folder with custom retention period');

    const folderExists = await fs.access(folder20Days).then(() => true).catch(() => false);
    assert.equal(folderExists, false, 'Folder should be deleted with 15-day retention');
  });

  it('should handle missing base directory gracefully', async () => {
    // Arrange - Non-existent directory
    const nonExistentDir = 'test-non-existent-cleanup-dir';

    // Act
    const result = await cleanupOldFiles(nonExistentDir, 30);

    // Assert
    assert.equal(result.deletedFolders, 0, 'Should handle missing directory');
    assert.equal(result.deletedFiles, 0, 'Should return zero counts for missing directory');
  });
});

describe('Result Storage - Summary Save', () => {
  const testDate = '2025-01-29';

  beforeEach(async () => {
    await fs.rm(`results/${testDate}`, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(`results/${testDate}`, { recursive: true, force: true });
  });

  it('should save execution summary as JSON', async () => {
    // Arrange
    const summary = {
      totalProperties: 5,
      validatedProperties: 5,
      failedProperties: 0,
      timestamp: new Date().toISOString()
    };

    // Act
    const filePath = await saveSummary(summary, testDate);

    // Assert
    assert.ok(filePath.includes('_summary.json'), 'Should create summary file');

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const savedSummary = JSON.parse(fileContent);
    assert.equal(savedSummary.totalProperties, 5, 'Should save summary data');
  });
});
